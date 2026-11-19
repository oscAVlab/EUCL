// EUCL app (osc[AV]lab) — Seq Euclidean x4, versión macOS con CoreMIDI nativo
#include "MainComponent.h"

class EuclApp : public juce::JUCEApplication
{
public:
    const juce::String getApplicationName() override    { return JUCE_APPLICATION_NAME_STRING; }
    const juce::String getApplicationVersion() override { return JUCE_APPLICATION_VERSION_STRING; }
    bool moreThanOneInstanceAllowed() override          { return false; }

    void initialise (const juce::String&) override
    {
        juce::PropertiesFile::Options o;
        o.applicationName = "EUCL";
        o.folderName = "osc[AV]lab";
        o.filenameSuffix = ".settings";
        o.osxLibrarySubFolder = "Application Support";
        o.millisecondsBeforeSaving = 1000;
        settings = std::make_unique<juce::PropertiesFile> (o);
        window = std::make_unique<Window> (*settings);
    }
    void shutdown() override
    {
        if (window) settings->setValue ("window", window->getWindowStateAsString());
        window.reset();
        settings->saveIfNeeded();
        settings.reset();
    }
    void systemRequestedQuit() override { quit(); }
    void anotherInstanceStarted (const juce::String&) override { if (window) window->toFront (true); }

private:
    struct Window : juce::DocumentWindow
    {
        explicit Window (juce::PropertiesFile& s)
            : DocumentWindow ("EUCL", eu::colours::ink, allButtons)
        {
            setUsingNativeTitleBar (true);
            setContentOwned (new eu::MainComponent (s), true);
            setResizable (true, false);
            setResizeLimits (900, 600, 6000, 3000);
            centreWithSize (getWidth(), getHeight());
            const auto st = s.getValue ("window");
            if (st.isNotEmpty()) restoreWindowStateFromString (st);
            setName (juce::String::fromUTF8 ("EUCL · Seq Euclidean x4 · osc[AV]lab"));
            setVisible (true);
        }
        void closeButtonPressed() override { juce::JUCEApplication::getInstance()->systemRequestedQuit(); }
    };
    std::unique_ptr<juce::PropertiesFile> settings;
    std::unique_ptr<Window> window;
};

START_JUCE_APPLICATION (EuclApp)
