// EUCL app (osc[AV]lab) — scheduler MIDI de alta precisión.
// La web programa las notas y el clock con ~120 ms de antelación (timestamps, como Web MIDI).
// Aquí se guardan en una cola por tiempo y un hilo de prioridad tiempo real las envía
// por CoreMIDI justo en su momento (espera + últimos ~0,6 ms en espera activa).
#pragma once
#include <juce_audio_devices/juce_audio_devices.h>
#include <atomic>
#include <memory>
#include <vector>

namespace eu
{
// Destino de los mensajes (un puerto MIDI). Se comparte con shared_ptr: si el puerto
// desaparece, los mensajes que ya estaban en cola no dejan punteros colgando.
struct MidiSink
{
    virtual ~MidiSink() = default;
    virtual void send (const juce::MidiMessage&) = 0;
};

struct MidiOutputSink : MidiSink
{
    explicit MidiOutputSink (std::unique_ptr<juce::MidiOutput> o) : out (std::move (o)) {}
    void send (const juce::MidiMessage& m) override { if (out) out->sendMessageNow (m); }
    std::unique_ptr<juce::MidiOutput> out;
};

class MidiScheduler : private juce::Thread
{
public:
    MidiScheduler();
    ~MidiScheduler() override;

    // Reloj común (ms, alta resolución; mach_absolute_time en macOS).
    static double nowMs() { return juce::Time::getMillisecondCounterHiRes(); }

    // Programa un mensaje para el instante atMs (reloj nowMs). atMs <= ahora → sale ya.
    void schedule (std::shared_ptr<MidiSink> sink, const juce::MidiMessage& m, double atMs);
    // Borra lo pendiente de ese puerto (Web MIDI output.clear(): Stop del secuenciador).
    void clear (const MidiSink* sink);
    void clearAll();

    size_t pending() const;
    bool isRealtime() const { return realtime; }

    // estadísticas: retraso medio y máximo real respecto al instante pedido (ms)
    struct Stats { double meanLateMs = 0, maxLateMs = 0; int64_t sent = 0; };
    Stats stats() const;
    void resetStats();

private:
    struct Ev
    {
        double t; uint64_t seq;
        std::shared_ptr<MidiSink> sink;
        juce::MidiMessage msg;
    };
    struct Later { bool operator() (const Ev& a, const Ev& b) const { return a.t > b.t || (! (a.t < b.t) && a.seq > b.seq); } };

    void run() override;

    mutable juce::CriticalSection lock;
    std::vector<Ev> heap;
    uint64_t seqCounter = 0;
    juce::WaitableEvent wake;
    bool realtime = false;

    mutable juce::SpinLock statLock;
    double lateSum = 0, lateMax = 0; int64_t sentCount = 0;
};
} // namespace eu
