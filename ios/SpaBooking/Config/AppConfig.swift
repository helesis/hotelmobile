import Foundation

/// Sunucu kökü (sonunda `/` olmadan). Örnek: http://localhost:3500
enum AppConfig {
    static var baseURL: URL {
        #if DEBUG
        URL(string: "http://localhost:3500")!
        #else
        URL(string: "https://your-production-host")!
        #endif
    }
}
