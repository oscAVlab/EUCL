#include "MainComponent.h"
#include "BinaryData.h"
#if JUCE_MAC
 #include "MacSupport.h"
#endif

namespace eu
{
namespace
{
const juce::String virtualOutId { "eu-virtual-out" };
const juce::String virtualInId  { "eu-virtual-in" };
const juce::String virtualName  { "EUCL" };
constexpr int stripHeight = 22;

struct Blob { const char* data; int size; };

const std::map<juce::String, Blob>& resources()
{
    static const auto map = []
    {
        std::map<juce::String, Blob> m;
        for (int i = 0; i < BinaryData::namedResourceListSize; ++i)
        {
            const char* name = BinaryData::namedResourceList[i];
            int size = 0;
            const char* data = BinaryData::getNamedResource (name, size);
            m[juce::String (BinaryData::getNamedResourceOriginalFilename (name))] = { data, size };
        }
        return m;
    }();
    return map;
}

juce::String resourceText (const juce::String& file)
{
    auto it = resources().find (file);
    if (it == resources().end()) return {};
    return juce::String::fromUTF8 (it->second.data, it->second.size);
}

juce::String mimeFor (const juce::String& file)
{
    const auto ext = file.fromLastOccurrenceOf (".", false, false).toLowerCase();
    if (ext == "html")  return "text/html; charset=utf-8";
    if (ext == "js")    return "text/javascript; charset=utf-8";
    if (ext == "css")   return "text/css; charset=utf-8";
    if (ext == "woff2") return "font/woff2";
    if (ext == "png")   return "image/png";
    if (ext == "svg")   return "image/svg+xml";
    if (ext == "json")  return "application/json";
    return "application/octet-stream";
}

juce::WebBrowserComponent::Resource makeResource (const juce::String& text, const juce::String& mime)
{
    juce::WebBrowserComponent::Resource r;
    const auto utf8 = text.toRawUTF8();
    const auto n = std::strlen (utf8);
    r.data.resize (n);
    std::memcpy (r.data.data(), utf8, n);
    r.mimeType = mime;
    return r;
}

// La web original (../index.html, la misma de GitHub Pages) con las fuentes en local
// y los reemplazos nativos al final del <body>.
juce::String patchedIndex()
{
    auto html = resourceText ("index.html");
    // Google Fonts → fuentes locales (funciona sin internet)
    {
        const int a = html.indexOf ("<link href=\"https://fonts.googleapis.com");
        if (a >= 0)
        {
            const int b = html.indexOf (a, ">");
            html = html.replaceSection (a, b - a + 1, "<link href=\"vendor/fonts.css\" rel=\"stylesheet\">");
        }
    }
    const int body = html.lastIndexOf ("</body>");
    const juce::String tail = "<script src=\"native-overrides.js\"></script>\n";
    html = body >= 0 ? html.replaceSection (body, 0, tail) : html + tail;
    return html;
}
} // namespace

juce::String MainComponent::webVersion()
{
    static const juce::String v = []
    {
        auto html = resourceText ("index.html");
        const int a = html.indexOf ("class=\"ver\">");
        if (a < 0) return juce::String ("?");
        auto s = html.substring (a + 12, html.indexOf (a, "<")).trim();
        return s.startsWithChar ('v') ? s : juce::String ("?");
    }();
    return v;
}

// ─────────────────────────────────────────────────────────────────────────────
MainComponent::MainComponent (juce::PropertiesFile& s) : settings (s)
{
   #if JUCE_MAC
    mac::keepAwakeForRealtime();
   #endif
    {
        auto parsed = juce::JSON::parse (settings.getValue ("webStore"));
        webStore = parsed.getDynamicObject() != nullptr ? parsed.getDynamicObject() : new juce::DynamicObject();
    }
    createVirtualPorts();
    deviceListConnection = juce::MidiDeviceListConnection::make ([this] { midiDevicesChanged(); });

    lastSaveDir = juce::File::getSpecialLocation (juce::File::userHomeDirectory).getChildFile ("Downloads");

    browser = std::make_unique<juce::WebBrowserComponent> (makeOptions());
    addAndMakeVisible (*browser);
    browser->goToURL (juce::WebBrowserComponent::getResourceProviderRoot());

    setSize (1440, 900);
    startTimer (300);
}

MainComponent::~MainComponent()
{
    stopTimer();
    cancelPendingUpdate();
    for (auto& [id, in] : inputs) if (in) in->stop();
    if (virtualIn) virtualIn->stop();
    browser.reset();
    scheduler.clearAll();
}

void MainComponent::createVirtualPorts()
{
   #if JUCE_MAC || JUCE_LINUX
    if (auto o = juce::MidiOutput::createNewDevice (virtualName))
        virtualOut = std::make_shared<MidiOutputSink> (std::move (o));
    virtualIn = juce::MidiInput::createNewDevice (virtualName, this);
    if (virtualIn) virtualIn->start();
   #endif
    statusText = virtualOut != nullptr ? "MIDI virtual: " + virtualName + "  (aparece en Ableton)"
                                       : juce::String ("MIDI virtual no disponible");
}

juce::String MainComponent::storeScript() const
{
    return "window.__EU_STORE=" + juce::JSON::toString (juce::var (webStore.get()), true) + ";\n";
}

void MainComponent::storeSet (const juce::var& v)
{
    if ((bool) v["clear"]) webStore->clear();
    else
    {
        const juce::Identifier k (v["k"].toString().isNotEmpty() ? v["k"].toString() : juce::String ("_"));
        if ((bool) v["del"]) webStore->removeProperty (k);
        else webStore->setProperty (k, v["v"].toString());
    }
    settings.setValue ("webStore", juce::JSON::toString (juce::var (webStore.get()), true));
}

juce::WebBrowserComponent::Options MainComponent::makeOptions()
{
    using Opt = juce::WebBrowserComponent::Options;
    using Completion = juce::WebBrowserComponent::NativeFunctionCompletion;

    return Opt{}
        .withBackend (Opt::Backend::defaultBackend)
        .withNativeIntegrationEnabled()
        .withKeepPageLoadedWhenBrowserIsHidden()
        .withUserScript (storeScript() + resourceText ("native-bridge.js"))
        .withResourceProvider ([this] (const juce::String& url) { return getResource (url); })
        // --- reloj: la web sincroniza performance.now() con el reloj del scheduler ---
        .withNativeFunction ("eu_now", [] (const juce::Array<juce::var>&, Completion done)
        {
            done (MidiScheduler::nowMs());
        })
        // --- MIDI ---
        .withNativeFunction ("eu_midi_list", [this] (const juce::Array<juce::var>&, Completion done)
        {
            done (midiList());
        })
        .withEventListener ("eu_midi_send", [this] (juce::var v)
        {
            // un mensaje {id,d,t} o un lote [{id,d,t}, ...]
            if (auto* arr = v.getArray())
                for (auto& m : *arr) sendMidi (m["id"].toString(), m["d"], (double) m["t"]);
            else
                sendMidi (v["id"].toString(), v["d"], (double) v["t"]);
        })
        .withEventListener ("eu_midi_clear", [this] (juce::var v)
        {
            const auto id = v["id"].toString();
            if (id == virtualOutId) scheduler.clear (virtualOut.get());
            else if (auto it = outputs.find (id); it != outputs.end()) scheduler.clear (it->second.get());
        })
        .withEventListener ("eu_midi_in", [this] (juce::var v)
        {
            setInputOpen (v["id"].toString(), (bool) v["open"]);
        })
        // --- almacenamiento (copia de localStorage en ~/Library/Application Support/osc[AV]lab) ---
        .withEventListener ("eu_store", [this] (juce::var v) { storeSet (v); })
        // --- archivos / sistema ---
        .withNativeFunction ("eu_save_file", [this] (const juce::Array<juce::var>& a, Completion done)
        {
            saveFile (a[0].toString(), a[1].toString(), std::move (done));
        })
        .withNativeFunction ("eu_open_url", [] (const juce::Array<juce::var>& a, Completion done)
        {
            const juce::URL url (a[0].toString());
            if (url.getScheme().startsWith ("http")) url.launchInDefaultBrowser();
            done (true);
        })
        .withNativeFunction ("eu_info", [this] (const juce::Array<juce::var>&, Completion done)
        {
            auto* o = new juce::DynamicObject();
            o->setProperty ("version", OSCAVLAB_VERSION);
            o->setProperty ("web", webVersion());
            o->setProperty ("realtime", scheduler.isRealtime());
            done (juce::var (o));
        });
}

std::optional<juce::WebBrowserComponent::Resource> MainComponent::getResource (const juce::String& url)
{
    auto path = url.upToFirstOccurrenceOf ("?", false, false);
    if (path.isEmpty() || path == "/" || path == "/index.html")
        return makeResource (patchedIndex(), mimeFor ("index.html"));

    const auto file = path.fromLastOccurrenceOf ("/", false, false);
    auto it = resources().find (file);
    if (it == resources().end()) return std::nullopt;

    juce::WebBrowserComponent::Resource r;
    r.data.resize ((size_t) it->second.size);
    std::memcpy (r.data.data(), it->second.data, (size_t) it->second.size);
    r.mimeType = mimeFor (file);
    return r;
}

// ─── MIDI ────────────────────────────────────────────────────────────────────
juce::var MainComponent::midiList() const
{
    auto port = [] (const juce::String& id, const juce::String& name, bool isVirtual)
    {
        auto* o = new juce::DynamicObject();
        o->setProperty ("id", id);
        o->setProperty ("name", name);
        o->setProperty ("virtual", isVirtual);
        return juce::var (o);
    };
    juce::Array<juce::var> ins, outs;
    if (virtualOut) outs.add (port (virtualOutId, virtualName + " (virtual)", true));
    if (virtualIn)  ins.add  (port (virtualInId,  virtualName + " (virtual)", true));
    for (auto& d : juce::MidiOutput::getAvailableDevices())
        if (d.name != virtualName) outs.add (port (d.identifier, d.name, false));
    for (auto& d : juce::MidiInput::getAvailableDevices())
        if (d.name != virtualName) ins.add (port (d.identifier, d.name, false));

    auto* o = new juce::DynamicObject();
    o->setProperty ("inputs", ins);
    o->setProperty ("outputs", outs);
    return juce::var (o);
}

std::shared_ptr<MidiSink> MainComponent::sinkFor (const juce::String& id)
{
    if (id == virtualOutId) return virtualOut;
    auto& slot = outputs[id];
    if (slot == nullptr)
        if (auto o = juce::MidiOutput::openDevice (id))
            slot = std::make_shared<MidiOutputSink> (std::move (o));
    return slot;
}

void MainComponent::sendMidi (const juce::String& id, const juce::var& bytes, double atMs)
{
    auto* arr = bytes.getArray();
    if (arr == nullptr || arr->isEmpty() || arr->size() > 3) return;   // sin SysEx
    uint8_t d[3] = {};
    const int n = arr->size();
    for (int i = 0; i < n; ++i) d[i] = (uint8_t) (int) (*arr)[i];
    if ((d[0] & 0x80) == 0) return;
    const auto msg = juce::MidiMessage (d, n);
    if (auto sink = sinkFor (id))
        scheduler.schedule (std::move (sink), msg, atMs);
}

void MainComponent::setInputOpen (const juce::String& id, bool open)
{
    if (id == virtualInId) { virtualInWanted = open; return; }
    // inputs / wantedInputs: sólo hilo de mensajes (inLock protege únicamente la cola)
    if (open)
    {
        wantedInputs.insert (id);
        if (inputs[id] == nullptr)
        {
            inputs[id] = juce::MidiInput::openDevice (id, this);
            if (inputs[id]) inputs[id]->start();
        }
    }
    else
    {
        wantedInputs.erase (id);
        auto it = inputs.find (id);
        if (it != inputs.end())
        {
            if (it->second) it->second->stop();
            inputs.erase (it);
        }
    }
}

void MainComponent::handleIncomingMidiMessage (juce::MidiInput* source, const juce::MidiMessage& m)
{
    if (m.isActiveSense() || m.isSysEx() || m.getRawDataSize() > 3) return;
    juce::String id;
    if (source == virtualIn.get())
    {
        if (! virtualInWanted) return;
        id = virtualInId;
    }
    else
        id = source->getIdentifier();

    // instante de llegada en el reloj del scheduler (JUCE lo marca al recibir el paquete)
    const double now = MidiScheduler::nowMs();
    double t = m.getTimeStamp() * 1000.0;
    if (t <= 0 || std::abs (t - now) > 1000.0) t = now;

    InMsg msg { id, {}, m.getRawDataSize(), t };
    std::memcpy (msg.data, m.getRawData(), (size_t) msg.size);
    {
        const juce::ScopedLock sl (inLock);
        if (inQueue.size() < 4096) inQueue.push_back (std::move (msg));
    }
    triggerAsyncUpdate();
}

void MainComponent::handleAsyncUpdate()
{
    std::vector<InMsg> batch;
    {
        const juce::ScopedLock sl (inLock);
        batch.swap (inQueue);
    }
    if (batch.empty() || browser == nullptr) return;
    juce::Array<juce::var> arr;
    for (auto& m : batch)
    {
        auto* o = new juce::DynamicObject();
        o->setProperty ("id", m.id);
        juce::Array<juce::var> d;
        for (int i = 0; i < m.size; ++i) d.add ((int) m.data[i]);
        o->setProperty ("d", d);
        o->setProperty ("t", m.t);
        arr.add (juce::var (o));
    }
    browser->emitEventIfBrowserIsVisible ("eu_midi_msgs", arr);
}

void MainComponent::midiDevicesChanged()
{
    // soltar salidas que ya no existen (lo que quedaba en cola mantiene vivo su puerto; se reabren solas)
    auto available = juce::MidiOutput::getAvailableDevices();
    for (auto it = outputs.begin(); it != outputs.end();)
    {
        bool present = false;
        for (auto& d : available) present = present || d.identifier == it->first;
        if (! present && it->second) scheduler.clear (it->second.get());
        it = present ? std::next (it) : outputs.erase (it);
    }
    // entradas: soltar las que desaparecieron y reabrir las pedidas que reaparecen
    auto availableIns = juce::MidiInput::getAvailableDevices();
    for (auto it = inputs.begin(); it != inputs.end();)
    {
        bool present = false;
        for (auto& d : availableIns) present = present || d.identifier == it->first;
        if (present) { ++it; continue; }
        if (it->second) it->second->stop();
        it = inputs.erase (it);
    }
    for (auto& id : wantedInputs)
        if (inputs[id] == nullptr)
        {
            inputs[id] = juce::MidiInput::openDevice (id, this);
            if (inputs[id]) inputs[id]->start();
        }
    if (browser) browser->emitEventIfBrowserIsVisible ("eu_midi_changed", midiList());
}

// ─── archivos ────────────────────────────────────────────────────────────────
void MainComponent::saveFile (const juce::String& name, const juce::String& base64,
                              juce::WebBrowserComponent::NativeFunctionCompletion done)
{
    auto data = std::make_shared<juce::MemoryOutputStream>();
    if (! juce::Base64::convertFromBase64 (*data, base64))
    {
        auto* o = new juce::DynamicObject();
        o->setProperty ("ok", false);
        o->setProperty ("error", "datos inválidos");
        done (juce::var (o));
        return;
    }
    const auto safe = juce::File::createLegalFileName (name.isEmpty() ? juce::String ("eucl_preset.json") : name);
    chooser = std::make_unique<juce::FileChooser> ("Guardar", lastSaveDir.getChildFile (safe),
                                                   "*." + safe.fromLastOccurrenceOf (".", false, false));
    chooser->launchAsync (juce::FileBrowserComponent::saveMode | juce::FileBrowserComponent::canSelectFiles
                              | juce::FileBrowserComponent::warnAboutOverwriting,
                          [this, data, done] (const juce::FileChooser& fc)
    {
        auto* o = new juce::DynamicObject();
        const auto f = fc.getResult();
        if (f == juce::File())
            o->setProperty ("ok", false);   // cancelado
        else
        {
            lastSaveDir = f.getParentDirectory();
            const bool ok = f.replaceWithData (data->getData(), data->getDataSize());
            o->setProperty ("ok", ok);
            if (! ok) o->setProperty ("error", "no se pudo escribir " + f.getFullPathName());
            else o->setProperty ("path", f.getFullPathName());
        }
        done (juce::var (o));
    });
}

// ─── UI ──────────────────────────────────────────────────────────────────────
void MainComponent::timerCallback()
{
   #if JUCE_MAC
    // el WKWebView se crea al mostrarse la ventana: ajustarlo en cuanto exista
    if (! webViewTweaked && tweakAttempts++ < 60)
        for (int i = 0; i < browser->getNumChildComponents(); ++i)
            if (auto* nv = dynamic_cast<juce::NSViewComponent*> (browser->getChildComponent (i)))
                if (mac::tweakWebView (nv->getView())) { webViewTweaked = true; break; }
   #endif
    // cada ~1,5 s: precisión real del scheduler en la barra superior
    if (++ticks % 5 == 0)
    {
        const auto st = scheduler.stats();
        scheduler.resetStats();
        juce::String s = virtualOut != nullptr ? "MIDI virtual: EUCL" : juce::String ("MIDI virtual no disponible");
        s << juce::String::fromUTF8 ("  ·  scheduler ") << (scheduler.isRealtime() ? "RT" : "alto");
        if (st.sent > 0)
            s << juce::String::fromUTF8 ("  ·  precisión ") << juce::String (st.meanLateMs, 2)
              << " ms (máx " << juce::String (st.maxLateMs, 2) << ")";
        if (s != statusText) { statusText = s; repaint (getLocalBounds().removeFromTop (stripHeight)); }
    }
}

void MainComponent::paint (juce::Graphics& g)
{
    g.fillAll (colours::ink);
    auto strip = getLocalBounds().removeFromTop (stripHeight);
    g.setColour (colours::line);
    g.fillRect (strip.removeFromBottom (1));

    g.setFont (juce::FontOptions (11.5f));
    g.setColour (colours::mute);
    g.drawText (juce::String::fromUTF8 ("EUCL · app v") + OSCAVLAB_VERSION
                    + juce::String::fromUTF8 (" · web ") + webVersion(),
                strip.reduced (12, 0), juce::Justification::centredLeft);
    g.drawText (statusText, strip.reduced (12, 0), juce::Justification::centredRight);

    // la firma ž ya la muestra la web arriba al centro (no se duplica aquí)
}

void MainComponent::resized()
{
    if (browser) browser->setBounds (getLocalBounds().withTrimmedTop (stripHeight));
}
} // namespace eu
