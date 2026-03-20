import Foundation

// MARK: - Masaj türü (API / massage_types satırı)

struct MassageTypeDTO: Codable, Identifiable, Hashable {
    let id: Int
    let name: String
    let description: String?
    let durationMinutes: Int
    let price: Double

    enum CodingKeys: String, CodingKey {
        case id, name, description, price
        case durationMinutes = "duration_minutes"
    }
}

// MARK: - Zaman dilimi indirimi

struct TimeSlotDiscountDTO: Codable, Identifiable {
    let id: Int
    let label: String?
    let startTime: String
    let endTime: String
    let discountPercent: Double

    enum CodingKeys: String, CodingKey {
        case id, label
        case startTime = "start_time"
        case endTime = "end_time"
        case discountPercent = "discount_percent"
    }
}

// MARK: - Müsaitlik sloru (GET /api/availability)

struct TherapistAtSlotDTO: Codable, Identifiable, Hashable {
    let id: Int
    let name: String
    let photoUrl: String?
    let startTime: String
    let endTime: String
    var massageTypes: [MassageTypeDTO]

    enum CodingKeys: String, CodingKey {
        case id, name
        case photoUrl = "photo_url"
        case startTime = "start_time"
        case endTime = "end_time"
        case massageTypes = "massage_types"
    }
}

struct AvailabilitySlotDTO: Codable, Identifiable, Hashable {
    var id: String { time }
    let time: String
    let available: Bool
    let availableTherapists: [TherapistAtSlotDTO]
    let totalTherapistsAtSlot: Int?
    let availabilityDiscount: Double?

    enum CodingKeys: String, CodingKey {
        case time, available
        case availableTherapists = "available_therapists"
        case totalTherapistsAtSlot = "total_therapists_at_slot"
        case availabilityDiscount = "availability_discount"
    }
}

// MARK: - Rezervasyon oluşturma

struct CreateReservationRequest: Encodable {
    let guestName: String
    let therapistId: Int
    let massageTypeId: Int
    let date: String
    let startTime: String

    enum CodingKeys: String, CodingKey {
        case guestName = "guest_name"
        case therapistId = "therapist_id"
        case massageTypeId = "massage_type_id"
        case date
        case startTime = "start_time"
    }
}

struct CreateReservationResponse: Decodable {
    let id: Int
    let roomId: Int
    let startTime: String
    let endTime: String
    let status: String
    let price: Double

    enum CodingKeys: String, CodingKey {
        case id, status, price
        case roomId = "room_id"
        case startTime = "start_time"
        case endTime = "end_time"
    }
}

// MARK: - API hata gövdesi

struct APIErrorBody: Decodable {
    let error: String?
}
