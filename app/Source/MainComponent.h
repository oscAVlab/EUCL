// EUCL app (osc[AV]lab) — ventana principal: la web de EUCL dentro de un WKWebView,
// con MIDI nativo (CoreMIDI): puertos virtuales "EUCL" y envío con timestamps reales.
#pragma once
#include <JuceHeader.h>
#include "MidiScheduler.h"

namespace eu
{
namespace colours
{
// Paleta osc[AV]lab V_2026
const juce::Colour ink      { 0xff0d0d0c };
const juce::Colour inkSoft  { 0xff26241f };
const juce::Colour line     { 0xff242420 };
const juce::Colour paper    { 0xfff4f1ea };
const juce::Colour mute     { 0xff7a766d };
const juce::Colour turq     { 0xff00b3a4 };
}

class MainComponent : public juce::Component,
                      private juce::MidiInputCallback,
                      private juce::AsyncUpdater,
                      private juce::Timer
{
public:
    explicit MainComponent (juce::PropertiesFile& settings);
    ~MainComponent() override;

    void paint (juce::Graphics&) override;
    void resized() override;

    static juce::String webVersion();

private:
    // MIDI
    juce::var midiList() const;
    std::shared_ptr<MidiSink> sinkFor (const juce::String& id);
    void sendMidi (const juce::String& id, const juce::var& bytes, double atMs);
    void setInputOpen (const juce::String& id, bool open);
    void handleIncomingMidiMessage (juce::MidiInput*, const juce::MidiMessage&) override;
    void handleAsyncUpdate() override;
    void midiDevicesChanged();
    void createVirtualPorts();

    // web
    std::optional<juce::WebBrowserComponent::Resource> getResource (const juce::String& url);
    juce::WebBrowserComponent::Options makeOptions();
    juce::String storeScript() const;
    void storeSet (const juce::var& v);
    void saveFile (const juce::String& name, const juce::String& base64,
                   juce::WebBrowserComponent::NativeFunctionCompletion done);
    void timerCallback() override;

    juce::PropertiesFile& settings;
    MidiScheduler scheduler;

    std::shared_ptr<MidiSink> virtualOut;
    std::unique_ptr<juce::MidiInput> virtualIn;
    std::map<juce::String, std::shared_ptr<MidiSink>> outputs;
    std::map<juce::String, std::unique_ptr<juce::MidiInput>> inputs;
    std::set<juce::String> wantedInputs;
    std::atomic<bool> virtualInWanted { false };
    juce::MidiDeviceListConnection deviceListConnection;

    struct InMsg { juce::String id; uint8_t data[3]; int size; double t; };
    juce::CriticalSection inLock;
    std::vector<InMsg> inQueue;

    juce::DynamicObject::Ptr webStore;   // copia de localStorage de la web (presets LOCAL, sesión, puertos)

    std::unique_ptr<juce::FileChooser> chooser;
    juce::File lastSaveDir;
    juce::String statusText;
    int tweakAttempts = 0;
    bool webViewTweaked = false;
    int ticks = 0;

    std::unique_ptr<juce::WebBrowserComponent> browser;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (MainComponent)
};
} // namespace eu
