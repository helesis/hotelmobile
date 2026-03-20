import Foundation
import Observation
import SwiftUI

/// `index.html` sihirbaz akışının ViewModel iskeleti.
@MainActor
@Observable
final class BookingViewModel {
    private let api = APIClient()

    var selectedDate: String = ""
    var slotDiscounts: [TimeSlotDiscountDTO] = []
    var currentSlots: [AvailabilitySlotDTO] = []
    var loadError: String?

    var selectedMassage: MassageTypeDTO?
    var selectedSlot: AvailabilitySlotDTO?
    var selectedTherapist: TherapistAtSlotDTO?

    var guestName: String = ""

    private var discountEngine: DiscountEngine { DiscountEngine(slotDiscounts: slotDiscounts) }

    var uniqueMassages: [MassageTypeDTO] {
        BookingFlowHelpers.uniqueMassages(from: currentSlots)
    }

    var slotsForSelectedMassage: [AvailabilitySlotDTO] {
        guard let m = selectedMassage else { return [] }
        return BookingFlowHelpers.slotsBookable(forMassageId: m.id, in: currentSlots)
    }

    var therapistsForSelection: [TherapistAtSlotDTO] {
        guard let m = selectedMassage, let s = selectedSlot else { return [] }
        return BookingFlowHelpers.therapists(forMassageId: m.id, in: s)
    }

    func discountedPrice(for slot: AvailabilitySlotDTO) -> Double {
        guard let m = selectedMassage else { return 0 }
        return discountEngine.discountedPrice(basePrice: m.price, slot: slot)
    }

    func combinedDiscount(for slot: AvailabilitySlotDTO) -> (percent: Double, label: String)? {
        discountEngine.combinedDiscount(for: slot)
    }

    /// İlk açılış: bugünden itibaren 7 gün için tarih listesi (İstanbul).
    static func defaultDateStrip(timeZone: TimeZone = TimeZone(identifier: "Europe/Istanbul")!) -> [String] {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = timeZone
        let today = cal.startOfDay(for: Date())
        return (0 ..< 7).compactMap { offset in
            guard let d = cal.date(byAdding: .day, value: offset, to: today) else { return nil }
            let y = cal.component(.year, from: d)
            let mo = cal.component(.month, from: d)
            let da = cal.component(.day, from: d)
            return String(format: "%04d-%02d-%02d", y, mo, da)
        }
    }

    func loadSlots() async {
        loadError = nil
        guard !selectedDate.isEmpty else { return }
        do {
            async let slotsTask = api.fetchAvailability(date: selectedDate)
            async let discTask = api.fetchTimeSlotDiscounts()
            currentSlots = try await slotsTask
            slotDiscounts = try await discTask
            clearSelectionAfterDateChange()
        } catch {
            loadError = error.localizedDescription
            currentSlots = []
        }
    }

    func selectMassage(_ m: MassageTypeDTO) {
        selectedMassage = m
        selectedSlot = nil
        selectedTherapist = nil
    }

    func selectSlot(_ s: AvailabilitySlotDTO) {
        selectedSlot = s
        selectedTherapist = nil
    }

    func selectTherapist(_ t: TherapistAtSlotDTO) {
        selectedTherapist = t
    }

    func confirmBooking() async throws {
        guard let m = selectedMassage, let s = selectedSlot, let th = selectedTherapist else { return }
        let name = guestName.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !name.isEmpty else { throw BookingVMError.guestNameRequired }

        let body = CreateReservationRequest(
            guestName: name,
            therapistId: th.id,
            massageTypeId: m.id,
            date: selectedDate,
            startTime: s.time
        )
        _ = try await api.createReservation(body)
        clearAfterSuccess()
        await loadSlots()
    }

    func resetWizard() {
        selectedMassage = nil
        selectedSlot = nil
        selectedTherapist = nil
    }

    private func clearSelectionAfterDateChange() {
        selectedMassage = nil
        selectedSlot = nil
        selectedTherapist = nil
    }

    private func clearAfterSuccess() {
        resetWizard()
    }
}

enum BookingVMError: LocalizedError {
    case guestNameRequired
    var errorDescription: String? {
        switch self {
        case .guestNameRequired: return "Misafir adı gerekli"
        }
    }
}
