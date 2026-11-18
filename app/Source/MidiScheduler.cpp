#include "MidiScheduler.h"
#include <algorithm>

namespace eu
{
namespace
{
constexpr double spinMs = 0.6;    // últimos ms en espera activa (precisión sub-milisegundo)
constexpr double maxWaitMs = 100; // como mucho, revisar la cola cada 100 ms
constexpr size_t maxQueue = 20000;
}

MidiScheduler::MidiScheduler() : juce::Thread ("EUCL MIDI scheduler")
{
    realtime = startRealtimeThread (juce::Thread::RealtimeOptions{}
                                        .withPriority (10)
                                        .withPeriodMs (1.0)
                                        .withMaximumProcessingTimeMs (0.5));
    if (! realtime) startThread (juce::Thread::Priority::highest);
}

MidiScheduler::~MidiScheduler()
{
    signalThreadShouldExit();
    wake.signal();
    stopThread (2000);
}

void MidiScheduler::schedule (std::shared_ptr<MidiSink> sink, const juce::MidiMessage& m, double atMs)
{
    if (sink == nullptr) return;
    {
        const juce::ScopedLock sl (lock);
        if (heap.size() >= maxQueue) return;   // protección: nunca crecer sin límite
        heap.push_back ({ atMs, seqCounter++, std::move (sink), m });
        std::push_heap (heap.begin(), heap.end(), Later{});
    }
    wake.signal();
}

void MidiScheduler::clear (const MidiSink* sink)
{
    const juce::ScopedLock sl (lock);
    heap.erase (std::remove_if (heap.begin(), heap.end(), [sink] (const Ev& e) { return e.sink.get() == sink; }), heap.end());
    std::make_heap (heap.begin(), heap.end(), Later{});
}

void MidiScheduler::clearAll()
{
    const juce::ScopedLock sl (lock);
    heap.clear();
}

size_t MidiScheduler::pending() const
{
    const juce::ScopedLock sl (lock);
    return heap.size();
}

MidiScheduler::Stats MidiScheduler::stats() const
{
    const juce::SpinLock::ScopedLockType sl (statLock);
    Stats s;
    s.sent = sentCount;
    s.maxLateMs = lateMax;
    s.meanLateMs = sentCount > 0 ? lateSum / (double) sentCount : 0.0;
    return s;
}

void MidiScheduler::resetStats()
{
    const juce::SpinLock::ScopedLockType sl (statLock);
    lateSum = lateMax = 0; sentCount = 0;
}

void MidiScheduler::run()
{
    std::vector<Ev> due;
    while (! threadShouldExit())
    {
        double next = -1;
        const double now = nowMs();
        {
            const juce::ScopedLock sl (lock);
            while (! heap.empty() && heap.front().t <= now + 0.02)
            {
                std::pop_heap (heap.begin(), heap.end(), Later{});
                due.push_back (std::move (heap.back()));
                heap.pop_back();
            }
            if (! heap.empty()) next = heap.front().t;
        }

        if (! due.empty())
        {
            for (auto& e : due)
            {
                e.sink->send (e.msg);
                const double late = juce::jmax (0.0, nowMs() - e.t);
                const juce::SpinLock::ScopedLockType sl (statLock);
                // sólo cuenta lo programado a futuro (lo "ya" no es retraso del scheduler)
                if (late < 50.0) { lateSum += late; lateMax = juce::jmax (lateMax, late); ++sentCount; }
            }
            due.clear();
            continue;
        }

        if (next < 0) { wake.wait (maxWaitMs); continue; }
        const double wait = next - nowMs();
        if (wait > spinMs + 0.2)
            wake.wait (juce::jmin (maxWaitMs, wait - spinMs));   // despierta antes si llega algo nuevo
        else
            juce::Thread::yield();                               // espera activa breve
    }
}
} // namespace eu
