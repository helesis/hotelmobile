import SwiftUI

/// Minimal SwiftUI akışı — stilleri kendi tasarımınıza göre zenginleştirin.
struct BookingFlowView: View {
    @State private var vm = BookingViewModel()

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    dateStripSection
                    if let err = vm.loadError {
                        ContentUnavailableView("Yüklenemedi", systemImage: "exclamationmark.triangle", description: Text(err))
                    } else {
                        massageSection
                        slotSection
                        therapistSection
                        confirmSection
                    }
                }
                .padding()
            }
            .navigationTitle("Spa Rezervasyon")
            .task {
                if vm.selectedDate.isEmpty, let first = BookingViewModel.defaultDateStrip().first {
                    vm.selectedDate = first
                }
                await vm.loadSlots()
            }
        }
    }

    private var dateStripSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Tarih")
                .font(.headline)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(BookingViewModel.defaultDateStrip(), id: \.self) { iso in
                        Button(iso) {
                            vm.selectedDate = iso
                            Task { await vm.loadSlots() }
                        }
                        .buttonStyle(.borderedProminent)
                        .tint(vm.selectedDate == iso ? .brown : .gray)
                    }
                }
            }
        }
    }

    private var massageSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("1 — Masaj türü")
                .font(.headline)
            if vm.uniqueMassages.isEmpty {
                Text("Bu tarihte müsait masaj türü yok.")
                    .foregroundStyle(.secondary)
            } else {
                ForEach(vm.uniqueMassages) { m in
                    Button {
                        vm.selectMassage(m)
                    } label: {
                        HStack {
                            VStack(alignment: .leading) {
                                Text(m.name).font(.subheadline.weight(.semibold))
                                Text("\(m.durationMinutes) dk · ₺\(Int(m.price)) liste")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                            Spacer()
                            if vm.selectedMassage?.id == m.id {
                                Image(systemName: "checkmark.circle.fill")
                            }
                        }
                        .padding(10)
                        .background(RoundedRectangle(cornerRadius: 10).strokeBorder(vm.selectedMassage?.id == m.id ? Color.brown : Color.gray.opacity(0.3)))
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private var slotSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("2 — Saat")
                .font(.headline)
            if vm.selectedMassage == nil {
                Text("Önce masaj seçin.")
                    .foregroundStyle(.secondary)
            } else if vm.slotsForSelectedMassage.isEmpty {
                Text("Bu masaj için müsait saat yok.")
                    .foregroundStyle(.secondary)
            } else {
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 88))], spacing: 8) {
                    ForEach(vm.slotsForSelectedMassage, id: \.time) { slot in
                        let finalP = vm.discountedPrice(for: slot)
                        let base = vm.selectedMassage?.price ?? 0
                        Button(slot.time) {
                            vm.selectSlot(slot)
                        }
                        .buttonStyle(.bordered)
                        .tint(vm.selectedSlot?.time == slot.time ? .brown : .secondary)
                        .accessibilityLabel("\(slot.time), ₺\(Int(finalP))")
                    }
                }
            }
        }
    }

    private var therapistSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("3 — Terapist")
                .font(.headline)
            if vm.selectedSlot == nil {
                EmptyView()
            } else if vm.therapistsForSelection.isEmpty {
                Text("Bu saat için uygun terapist yok.")
                    .foregroundStyle(.secondary)
            } else {
                ForEach(vm.therapistsForSelection, id: \.id) { t in
                    Button(t.name) {
                        vm.selectTherapist(t)
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(vm.selectedTherapist?.id == t.id ? .brown : .gray)
                }
            }
        }
    }

    private var confirmSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("4 — Onay")
                .font(.headline)
            if vm.selectedTherapist != nil {
                TextField("Misafir adı", text: $vm.guestName)
                    .textFieldStyle(.roundedBorder)
                Button("Rezervasyonu tamamla") {
                    Task {
                        do {
                            try await vm.confirmBooking()
                        } catch {
                            // Toast / alert ekleyin
                        }
                    }
                }
                .buttonStyle(.borderedProminent)
                .tint(.brown)

                Button("İptal / Sıfırla", role: .cancel) {
                    vm.resetWizard()
                }
            }
        }
    }
}

#Preview {
    BookingFlowView()
}
