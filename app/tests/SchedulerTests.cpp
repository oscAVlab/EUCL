// Pruebas del scheduler MIDI (sin interfaz): orden, puntualidad y clear().
#include "../Source/MidiScheduler.h"
#include <cstdio>
#include <mutex>

namespace
{
struct RecordingSink : eu::MidiSink
{
    struct Rec { double sentAt; int tag; };
    std::mutex m; std::vector<Rec> recs;
    void send (const juce::MidiMessage& msg) override
    {
        const double t = eu::MidiScheduler::nowMs();
        std::lock_guard<std::mutex> l (m);
        recs.push_back ({ t, msg.getNoteNumber() + 128 * msg.getVelocity() });
    }
};
int failures = 0;
void check (bool ok, const char* what) { std::printf ("%s %s\n", ok ? "OK  " : "FAIL", what); if (! ok) ++failures; }
}

int main()
{
    juce::ScopedJuceInitialiser_GUI init;   // MessageManager para el hilo
    eu::MidiScheduler sched;
    std::printf ("hilo tiempo real: %s\n", sched.isRealtime() ? "si" : "no (prioridad alta)");

    // 1) 400 notas a tiempos aleatorios en los próximos 5..400 ms: puntualidad y orden
    auto sink = std::make_shared<RecordingSink>();
    juce::Random rnd (42);
    std::vector<double> wanted;
    const double base = eu::MidiScheduler::nowMs();
    for (int i = 0; i < 400; ++i)
    {
        const double at = base + 5 + rnd.nextDouble() * 395;
        wanted.push_back (at);
        sched.schedule (sink, juce::MidiMessage::noteOn (1, i % 128, (juce::uint8) (1 + i / 128)), at);
    }
    juce::Thread::sleep (600);
    {
        std::lock_guard<std::mutex> l (sink->m);
        check (sink->recs.size() == 400, "todas las notas enviadas");
        double maxLate = 0, sum = 0, early = 0; bool ordered = true;
        for (size_t i = 0; i < sink->recs.size(); ++i)
        {
            const int idx = (sink->recs[i].tag % 128) + 128 * ((sink->recs[i].tag / 128) - 1);
            const double late = sink->recs[i].sentAt - wanted[(size_t) idx];
            maxLate = std::max (maxLate, late); sum += late; early = std::min (early, late);
            if (i > 0 && sink->recs[i].sentAt + 1e-9 < sink->recs[i - 1].sentAt) ordered = false;
        }
        std::printf ("     retraso medio %.3f ms, máx %.3f ms, adelanto máx %.3f ms\n", sum / 400, maxLate, -early);
        check (ordered, "salen en orden de tiempo");
        check (early > -0.05, "ninguna sale antes de tiempo");
        check (maxLate < 2.0, "retraso máximo < 2 ms");
    }

    // 2) clear(): lo pendiente de un puerto se borra, el otro puerto sigue
    auto a = std::make_shared<RecordingSink>(), b = std::make_shared<RecordingSink>();
    const double t0 = eu::MidiScheduler::nowMs();
    for (int i = 0; i < 20; ++i)
    {
        sched.schedule (a, juce::MidiMessage::noteOn (1, 60, (juce::uint8) 100), t0 + 50 + i * 5);
        sched.schedule (b, juce::MidiMessage::noteOn (1, 61, (juce::uint8) 100), t0 + 50 + i * 5);
    }
    sched.clear (a.get());
    juce::Thread::sleep (250);
    check (a->recs.empty(), "clear() borra la cola de ese puerto");
    check (b->recs.size() == 20, "el otro puerto no se toca");

    // 3) clock de 24 PPQN a 174 BPM durante 1 s: jitter entre pulsos
    auto c = std::make_shared<RecordingSink>();
    const double per = 60000.0 / 174.0 / 24.0, s0 = eu::MidiScheduler::nowMs() + 20;
    const int pulses = (int) (1000 / per);
    for (int i = 0; i < pulses; ++i) sched.schedule (c, juce::MidiMessage::midiClock(), s0 + i * per);
    juce::Thread::sleep (1150);
    double jit = 0;
    for (size_t i = 1; i < c->recs.size(); ++i) jit = std::max (jit, std::abs ((c->recs[i].sentAt - c->recs[i - 1].sentAt) - per));
    std::printf ("     clock: %d pulsos, jitter máx %.3f ms (periodo %.3f ms)\n", (int) c->recs.size(), jit, per);
    check ((int) c->recs.size() == pulses, "todos los pulsos de clock");
    check (jit < 2.0, "jitter del clock < 2 ms");

    std::printf (failures == 0 ? "\nTODO OK\n" : "\n%d FALLOS\n", failures);
    return failures == 0 ? 0 : 1;
}
