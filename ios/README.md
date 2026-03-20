# Spa Booking — iOS (Swift) iskelet

`index.html` ile aynı API’yi (`/api/...`) kullanır; sunucu `server.js` + `spa.db` çalışır durumda olmalı.

## Xcode’a ekleme

1. **File → New → Project → App** (SwiftUI, Swift 5.9+ önerilir).
2. Bu klasördeki `SpaBooking` altındaki `.swift` dosyalarını projeye **Copy items if needed** ile ekleyin.
3. `AppConfig.swift` içinde `baseURL` değerini ayarlayın (örn. `http://192.168.1.x:3500` veya production URL).
4. Geliştirmede HTTP için **Info.plist → App Transport Security** (ör. `NSAllowsArbitraryLoads` yalnızca debug).

## Admin

`admin.html` için ayrı bir SwiftUI görünümünde `WKWebView` ile `\(baseURL)/admin` yükleyin (aynı host, `/api` göreli URL’ler çalışır).
