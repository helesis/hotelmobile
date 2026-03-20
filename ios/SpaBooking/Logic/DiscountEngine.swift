import Foundation

/// `public/index.html` içindeki indirim / fiyat mantığının Swift karşılığı.

struct DiscountEngine {
    let slotDiscounts: [TimeSlotDiscountDTO]

    /// Saat string'i (ör. "14:30") için en iyi zaman dilimi indirimi.
    func discountInfo(forSlotTime slotTime: String) -> (percent: Double, label: String)? {
        let parts = slotTime.split(separator: ":").compactMap { Int($0) }
        guard parts.count >= 2 else { return nil }
        let slotMins = parts[0] * 60 + parts[1]

        var best: (percent: Double, label: String)?

        for d in slotDiscounts {
            let pct = d.discountPercent
            guard pct > 0 else { continue }
            let start = minutes(from: d.startTime)
            let end = minutes(from: d.endTime)
            guard slotMins >= start && slotMins < end else { continue }
            if best == nil || pct > best!.percent {
                best = (pct, d.label ?? "")
            }
        }
        return best
    }

    /// Zaman dilimi + müsaitlik indiriminden maksimum (index.html ile aynı).
    func combinedDiscount(for slot: AvailabilitySlotDTO) -> (percent: Double, label: String)? {
        let timeDisc = discountInfo(forSlotTime: slot.time)
        let availDisc = slot.availabilityDiscount ?? 0
        let timePercent = timeDisc?.percent ?? 0
        let percent = max(timePercent, availDisc)
        guard percent > 0 else { return nil }
        let label: String
        if percent == timePercent, let l = timeDisc?.label, !l.isEmpty {
            label = l
        } else {
            label = "Müsaitlik indirimi"
        }
        return (percent, label)
    }

    func combinedDiscountPercent(for slot: AvailabilitySlotDTO) -> Double {
        if let c = combinedDiscount(for: slot) { return c.percent }
        return slot.availabilityDiscount ?? 0
    }

    func discountedPrice(basePrice: Double, slot: AvailabilitySlotDTO) -> Double {
        let p = combinedDiscountPercent(for: slot)
        return (basePrice * (1 - p / 100)).rounded()
    }

    private func minutes(from time: String) -> Int {
        let p = time.split(separator: ":").compactMap { Int($0) }
        guard p.count >= 2 else { return 0 }
        return p[0] * 60 + p[1]
    }
}

// MARK: - index.html: buildUniqueMassagesFromSlots

enum BookingFlowHelpers {
    /// Tüm müsait slotlarda en az bir terapistin yapabildiği eşsiz masaj türleri.
    static func uniqueMassages(from slots: [AvailabilitySlotDTO]) -> [MassageTypeDTO] {
        var map: [Int: MassageTypeDTO] = [:]
        for slot in slots {
            for t in slot.availableTherapists {
                for m in t.massageTypes {
                    if map[m.id] == nil { map[m.id] = m }
                }
            }
        }
        return map.values.sorted { ($0.name).localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
    }

    /// Seçilen masaj için rezervasyonu olan slotlar (available + terapist o masajı yapıyor).
    static func slotsBookable(forMassageId id: Int, in slots: [AvailabilitySlotDTO]) -> [AvailabilitySlotDTO] {
        slots.filter { slot in
            slot.availableTherapists.contains { t in
                t.massageTypes.contains { $0.id == id }
            }
        }
    }

    static func therapists(forMassageId id: Int, in slot: AvailabilitySlotDTO) -> [TherapistAtSlotDTO] {
        slot.availableTherapists.filter { t in
            t.massageTypes.contains { $0.id == id }
        }
    }
}
