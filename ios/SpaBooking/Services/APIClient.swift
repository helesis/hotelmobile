import Foundation

enum APIClientError: LocalizedError {
    case invalidURL
    case httpStatus(Int, String?)
    case decoding(Error)

    var errorDescription: String? {
        switch self {
        case .invalidURL: return "Geçersiz URL"
        case .httpStatus(let code, let msg): return msg ?? "HTTP \(code)"
        case .decoding(let e): return e.localizedDescription
        }
    }
}

/// `public/index.html` ile aynı uçlar.
actor APIClient {
    private let baseURL: URL
    private let session: URLSession
    private let decoder: JSONDecoder
    private let encoder: JSONEncoder

    init(baseURL: URL = AppConfig.baseURL, session: URLSession = .shared) {
        self.baseURL = baseURL
        self.session = session
        self.decoder = JSONDecoder()
        self.encoder = JSONEncoder()
    }

    // MARK: - GET /api/availability?date=

    func fetchAvailability(date: String) async throws -> [AvailabilitySlotDTO] {
        var c = URLComponents(url: baseURL.appendingPathComponent("api/availability"), resolvingAgainstBaseURL: false)!
        c.queryItems = [URLQueryItem(name: "date", value: date)]
        guard let url = c.url else { throw APIClientError.invalidURL }
        return try await get(url)
    }

    // MARK: - GET /api/time-slot-discounts

    func fetchTimeSlotDiscounts() async throws -> [TimeSlotDiscountDTO] {
        let url = baseURL.appendingPathComponent("api/time-slot-discounts")
        return try await get(url)
    }

    // MARK: - POST /api/reservations

    func createReservation(_ body: CreateReservationRequest) async throws -> CreateReservationResponse {
        let url = baseURL.appendingPathComponent("api/reservations")
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try encoder.encode(body)
        return try await send(req)
    }

    // MARK: - İç yardımcılar

    private func get<T: Decodable>(_ url: URL) async throws -> T {
        var req = URLRequest(url: url)
        req.httpMethod = "GET"
        return try await send(req)
    }

    private func send<T: Decodable>(_ request: URLRequest) async throws -> T {
        let (data, response) = try await session.data(for: request)
        let http = response as? HTTPURLResponse
        let code = http?.statusCode ?? 0
        guard (200 ... 299).contains(code) else {
            let msg = (try? decoder.decode(APIErrorBody.self, from: data))?.error
            throw APIClientError.httpStatus(code, msg)
        }
        do {
            return try decoder.decode(T.self, from: data)
        } catch {
            throw APIClientError.decoding(error)
        }
    }
}
