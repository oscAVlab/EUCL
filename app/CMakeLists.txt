cmake_minimum_required(VERSION 3.22)

set(EU_VERSION 0.1.1)            # versión de paquete (macOS)
set(EU_VERSION_SHORT "0.1.1")      # versión osc[AV]lab de la app (v0.1, v0.2, ...)
project(OSCAVLAB_EUCL VERSION ${EU_VERSION} LANGUAGES C CXX)
if(APPLE)
    enable_language(OBJCXX)
endif()

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_OSX_DEPLOYMENT_TARGET "11.0" CACHE STRING "")

option(EUCL_APP   "Compilar la app" ON)
option(EUCL_TESTS "Compilar las pruebas del scheduler MIDI" OFF)

# JUCE: usa ./JUCE si existe (offline), si no lo descarga una vez.
if(EXISTS "${CMAKE_CURRENT_SOURCE_DIR}/JUCE/CMakeLists.txt")
    add_subdirectory(JUCE)
else()
    include(FetchContent)
    FetchContent_Declare(JUCE
        GIT_REPOSITORY https://github.com/juce-framework/JUCE.git
        GIT_TAG 8.0.4
        GIT_SHALLOW TRUE)
    FetchContent_MakeAvailable(JUCE)
endif()

if(EUCL_APP)
    juce_add_gui_app(EUCL
        PRODUCT_NAME "EUCL"
        COMPANY_NAME "osc[AV]lab"
        BUNDLE_ID "com.oscavlab.eucl"
        VERSION ${EU_VERSION}
        ICON_BIG assets/icon.png
        NEEDS_WEB_BROWSER TRUE)

    juce_generate_juce_header(EUCL)

    # La web de EUCL se toma TAL CUAL de la raíz del repo (../index.html = GitHub Pages),
    # así la app y la web son siempre la misma versión. Nombres de archivo únicos (se sirven por nombre).
    juce_add_binary_data(EUCLWeb SOURCES
        ../index.html
        ../assets/logo-oscavlab.png
        web/native-bridge.js
        web/native-overrides.js
        web/vendor/fonts.css
        web/vendor/font-robotocondensed-latin.woff2
        web/vendor/font-robotocondensed-latin-ext.woff2
        web/vendor/font-robotomono-latin.woff2
        web/vendor/font-robotomono-latin-ext.woff2)

    target_sources(EUCL PRIVATE
        Source/Main.cpp
        Source/MainComponent.cpp
        Source/MidiScheduler.cpp)
    if(APPLE)
        target_sources(EUCL PRIVATE Source/MacSupport.mm)
        target_link_libraries(EUCL PRIVATE "-framework WebKit")
    endif()

    target_compile_definitions(EUCL PRIVATE
        JUCE_APPLICATION_NAME_STRING="$<TARGET_PROPERTY:EUCL,JUCE_PRODUCT_NAME>"
        JUCE_APPLICATION_VERSION_STRING="$<TARGET_PROPERTY:EUCL,JUCE_VERSION>"
        OSCAVLAB_VERSION="${EU_VERSION_SHORT}"
        JUCE_USE_CURL=0
        JUCE_WEB_BROWSER=1)

    target_link_libraries(EUCL PRIVATE
        EUCLWeb
        juce::juce_audio_devices
        juce::juce_gui_extra
        PUBLIC
        juce::juce_recommended_config_flags
        juce::juce_recommended_lto_flags
        juce::juce_recommended_warning_flags)
endif()

if(EUCL_TESTS)
    juce_add_console_app(EUCLTests PRODUCT_NAME "EUCLTests")
    target_sources(EUCLTests PRIVATE Source/MidiScheduler.cpp tests/SchedulerTests.cpp)
    target_compile_definitions(EUCLTests PRIVATE JUCE_USE_CURL=0 JUCE_WEB_BROWSER=0)
    target_link_libraries(EUCLTests PRIVATE juce::juce_audio_devices
        PUBLIC juce::juce_recommended_config_flags juce::juce_recommended_warning_flags)
endif()
