// Bu dosyayı Xcode’daki `SpaBookingApp.swift` içeriğiyle birleştirin
// veya adını `SpaBookingApp.swift` yapıp hedefe ekleyin.

import SwiftUI

@main
struct SpaBookingApp: App {
    var body: some Scene {
        WindowGroup {
            TabView {
                BookingFlowView()
                    .tabItem { Label("Rezervasyon", systemImage: "calendar") }
                AdminContainerView()
                    .tabItem { Label("Yönetim", systemImage: "gearshape") }
            }
        }
    }
}
