// EUCL app (osc[AV]lab) — WKWebView: alert/confirm/prompt nativos, sin frenado en segundo plano, App Nap off
#include "MacSupport.h"
#import <Cocoa/Cocoa.h>
#import <WebKit/WebKit.h>
#import <objc/runtime.h>

namespace
{
id appNapToken = nil;

WKWebView* findWebView (NSView* v)
{
    if (v == nil) return nil;
    if ([v isKindOfClass:[WKWebView class]]) return (WKWebView*) v;
    for (NSView* sub in [v subviews])
        if (auto* w = findWebView (sub)) return w;
    return nil;
}

void setPref (WKPreferences* prefs, NSString* key, BOOL value)
{
    @try { [prefs setValue:@(value) forKey:key]; }
    @catch (NSException*) {}
}

// --- WKUIDelegate: alert / confirm / prompt con NSAlert ---
void euAlert (id, SEL, WKWebView*, NSString* message, WKFrameInfo*, void (^completion)(void))
{
    NSAlert* a = [[NSAlert alloc] init];
    [a setMessageText:@"EUCL"];
    [a setInformativeText:message ?: @""];
    [a addButtonWithTitle:@"OK"];
    [a runModal];
    [a release];
    completion();
}

void euConfirm (id, SEL, WKWebView*, NSString* message, WKFrameInfo*, void (^completion)(BOOL))
{
    NSAlert* a = [[NSAlert alloc] init];
    [a setMessageText:@"EUCL"];
    [a setInformativeText:message ?: @""];
    [a addButtonWithTitle:@"OK"];
    [a addButtonWithTitle:@"Cancelar"];
    const BOOL ok = [a runModal] == NSAlertFirstButtonReturn;
    [a release];
    completion (ok);
}

void euPrompt (id, SEL, WKWebView*, NSString* message, NSString* defaultText, WKFrameInfo*, void (^completion)(NSString*))
{
    NSAlert* a = [[NSAlert alloc] init];
    [a setMessageText:@"EUCL"];
    [a setInformativeText:message ?: @""];
    [a addButtonWithTitle:@"OK"];
    [a addButtonWithTitle:@"Cancelar"];
    NSTextField* field = [[NSTextField alloc] initWithFrame:NSMakeRect (0, 0, 260, 24)];
    [field setStringValue:defaultText ?: @""];
    [a setAccessoryView:field];
    const BOOL ok = [a runModal] == NSAlertFirstButtonReturn;
    NSString* result = ok ? [[[field stringValue] copy] autorelease] : nil;
    [field release];
    [a release];
    completion (result);
}

void addMethodIfMissing (Class cls, SEL sel, IMP imp, const char* types)
{
    if (! class_getInstanceMethod (cls, sel))
        class_addMethod (cls, sel, imp, types);
}
} // namespace

namespace eu::mac
{
void keepAwakeForRealtime()
{
    if (appNapToken != nil) return;
    appNapToken = [[[NSProcessInfo processInfo]
        beginActivityWithOptions:(NSActivityUserInitiatedAllowingIdleSystemSleep | NSActivityLatencyCritical)
                          reason:@"EUCL: secuenciador y MIDI en tiempo real"] retain];
}

bool tweakWebView (void* nsViewHandle)
{
    WKWebView* web = findWebView ((NSView*) nsViewHandle);
    if (web == nil) return false;

    WKPreferences* prefs = [[web configuration] preferences];
    setPref (prefs, @"hiddenPageDOMTimerThrottlingEnabled", NO);
    setPref (prefs, @"hiddenPageDOMTimerThrottlingAutoIncreases", NO);
    setPref (prefs, @"pageVisibilityBasedProcessSuppressionEnabled", NO);
    setPref (prefs, @"developerExtrasEnabled", YES);

    // macOS 13.3+: permitir Safari > Desarrollo (sin depender de la versión del SDK)
    if ([web respondsToSelector:NSSelectorFromString (@"setInspectable:")])
        @try { [web setValue:@YES forKey:@"inspectable"]; } @catch (NSException*) {}

    id ui = [web UIDelegate];
    if (ui != nil)
    {
        Class cls = [ui class];
        addMethodIfMissing (cls, @selector (webView:runJavaScriptAlertPanelWithMessage:initiatedByFrame:completionHandler:),
                            (IMP) euAlert, "v@:@@@@?");
        addMethodIfMissing (cls, @selector (webView:runJavaScriptConfirmPanelWithMessage:initiatedByFrame:completionHandler:),
                            (IMP) euConfirm, "v@:@@@@?");
        addMethodIfMissing (cls, @selector (webView:runJavaScriptTextInputPanelWithPrompt:defaultText:initiatedByFrame:completionHandler:),
                            (IMP) euPrompt, "v@:@@@@@?");
        // WebKit guarda qué métodos tiene el delegate al asignarlo: re-asignar para que vea los nuevos
        [web setUIDelegate:nil];
        [web setUIDelegate:ui];
    }
    return true;
}
} // namespace eu::mac
