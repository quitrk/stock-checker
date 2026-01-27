// CatalystsSection.swift
// StockIQ

import SwiftUI

// MARK: - Catalyst Filter

enum CatalystFilter: String, CaseIterable, Identifiable {
    case earnings
    case pdufa
    case fda
    case phase1
    case phase2
    case phase3
    case dividends
    case sec
    case other

    var id: String { rawValue }

    var label: String {
        switch self {
        case .earnings: return "Earnings"
        case .pdufa: return "PDUFA"
        case .fda: return "FDA"
        case .phase1: return "Phase 1"
        case .phase2: return "Phase 2"
        case .phase3: return "Phase 3"
        case .dividends: return "Dividends"
        case .sec: return "SEC"
        case .other: return "Other"
        }
    }

    var icon: String {
        switch self {
        case .earnings: return "chart.bar.fill"
        case .pdufa: return "calendar"
        case .fda: return "checkmark.seal.fill"
        case .phase1, .phase2, .phase3: return "cross.case.fill"
        case .dividends: return "dollarsign.circle.fill"
        case .sec: return "doc.text.fill"
        case .other: return "pin.fill"
        }
    }

    var color: Color {
        switch self {
        case .earnings: return .blue
        case .pdufa, .fda: return .pink
        case .phase1, .phase2, .phase3: return .purple
        case .dividends: return .green
        case .sec: return .secondary
        case .other: return .orange
        }
    }

    func matches(_ event: CatalystEvent) -> Bool {
        switch self {
        case .earnings:
            return event.eventType == .earnings || event.eventType == .earningsCall
        case .pdufa:
            return event.eventType == .pdufaDate
        case .fda:
            return event.eventType == .fdaApproval
        case .phase1:
            return event.eventType == .clinicalTrial && event.title.contains("Phase 1")
        case .phase2:
            return event.eventType == .clinicalTrial && event.title.contains("Phase 2")
        case .phase3:
            return event.eventType == .clinicalTrial && event.title.contains("Phase 3")
        case .dividends:
            return event.eventType == .exDividend || event.eventType == .dividendPayment
        case .sec:
            return event.eventType == .secFiling
        case .other:
            let otherTypes: [CatalystEventType] = [.analystRating, .insiderTransaction, .executiveChange, .acquisition, .partnership, .stockSplit, .reverseSplit]
            return otherTypes.contains(event.eventType)
        }
    }
}

struct CatalystsSection: View {
    let catalystEvents: [CatalystEvent]
    var currentSymbol: String? = nil
    var embedded: Bool = false

    @State private var isExpanded = true
    @State private var selectedFilters: Set<CatalystFilter>? = nil
    @State private var selectedSegment: CatalystSegment = .upcoming
    @State private var showFilterSheet = false

    private enum CatalystSegment: String, CaseIterable {
        case upcoming = "Upcoming"
        case past = "Past"
    }

    private var availableFilters: [CatalystFilter] {
        CatalystFilter.allCases.filter { filter in
            catalystEvents.contains { filter.matches($0) }
        }
    }

    private var activeFilterCount: Int {
        guard let selected = selectedFilters else { return 0 }
        let allSelected = selected.count == availableFilters.count
        return allSelected ? 0 : selected.count
    }

    /// Compute default filters based on available events
    private var effectiveFilters: Set<CatalystFilter> {
        if let selected = selectedFilters {
            return selected
        }
        // Default: select filters for event types that exist
        var defaults: Set<CatalystFilter> = []
        for filter in CatalystFilter.allCases {
            if catalystEvents.contains(where: { filter.matches($0) }) {
                defaults.insert(filter)
            }
        }
        return defaults
    }

    private var filteredEvents: [CatalystEvent] {
        let filters = effectiveFilters
        if filters.isEmpty {
            return catalystEvents
        }
        return catalystEvents.filter { event in
            filters.contains { $0.matches(event) }
        }
    }

    private var futureEvents: [CatalystEvent] {
        let oneYearFromNow = Calendar.current.date(byAdding: .year, value: 1, to: Date()) ?? Date()
        return filteredEvents
            .filter { $0.isFuture && ($0.eventDate ?? Date()) <= oneYearFromNow }
            .sorted { ($0.eventDate ?? Date()) < ($1.eventDate ?? Date()) }
    }

    private var recentPastEvents: [CatalystEvent] {
        let sixtyDaysAgo = Calendar.current.date(byAdding: .day, value: -60, to: Date()) ?? Date()
        return filteredEvents
            .filter { !$0.isFuture && ($0.eventDate ?? Date()) >= sixtyDaysAgo }
            .sorted { ($0.eventDate ?? Date()) > ($1.eventDate ?? Date()) }
            .prefix(5)
            .map { $0 }
    }

    private var summary: String? {
        if let first = futureEvents.first {
            return "\(first.eventType.displayName) \(formatDate(first.date))"
        } else if !recentPastEvents.isEmpty {
            return "\(recentPastEvents.count) past event\(recentPastEvents.count > 1 ? "s" : "")"
        }
        return nil
    }

    private var catalystContent: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Controls row: Segmented control + Filter button
            HStack(spacing: 12) {
                // Segmented control (only if both have events)
                if !futureEvents.isEmpty && !recentPastEvents.isEmpty {
                    Picker("", selection: $selectedSegment) {
                        Text("Upcoming").tag(CatalystSegment.upcoming)
                        Text("Past").tag(CatalystSegment.past)
                    }
                    .pickerStyle(.segmented)
                }

                // Filter button (only if multiple filter types available)
                if availableFilters.count > 1 {
                    Button {
                        showFilterSheet = true
                    } label: {
                        HStack(spacing: 4) {
                            Image(systemName: "line.3.horizontal.decrease.circle")
                            if activeFilterCount > 0 {
                                Text("\(activeFilterCount)")
                                    .font(.caption2)
                                    .fontWeight(.bold)
                            }
                        }
                        .foregroundStyle(activeFilterCount > 0 ? .blue : .secondary)
                    }
                }
            }
            .padding(.top, embedded ? 0 : 4)

            // Show selected segment's events (or the only available one)
            if selectedSegment == .upcoming && !futureEvents.isEmpty || recentPastEvents.isEmpty {
                ForEach(futureEvents) { event in
                    CatalystEventRowLink(event: event, showSymbol: currentSymbol == nil)
                }
            } else {
                ForEach(recentPastEvents) { event in
                    CatalystEventRowLink(event: event, showSymbol: currentSymbol == nil, isPast: true)
                }
            }
        }
    }

    private var filterSheet: some View {
        CatalystFilterSheet(
            availableFilters: availableFilters,
            selectedFilters: effectiveFilters,
            onApply: { newFilters in
                selectedFilters = newFilters
            }
        )
        .presentationDetents([.medium])
    }

    var body: some View {
        if futureEvents.isEmpty && recentPastEvents.isEmpty {
            EmptyView()
        } else if embedded {
            catalystContent
                .sheet(isPresented: $showFilterSheet) {
                    filterSheet
                }
        } else {
            DisclosureGroup(isExpanded: $isExpanded) {
                Divider()
                    .padding(.top, 8)
                    .padding(.bottom, 8)

                catalystContent
            } label: {
                HStack {
                    Text("Catalysts")
                        .font(.headline)
                    Spacer()
                    if let summary = summary {
                        Text(summary)
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                }
            }
            .padding()
            .background(Color(.secondarySystemGroupedBackground))
            .clipShape(RoundedRectangle(cornerRadius: 12))
            .padding(.horizontal)
            .sheet(isPresented: $showFilterSheet) {
                filterSheet
            }
        }
    }

    private func formatDate(_ dateStr: String) -> String {
        guard let date = DateFormatter.apiDate.date(from: dateStr) else { return dateStr }
        let now = Date()
        let sameYear = Calendar.current.component(.year, from: date) == Calendar.current.component(.year, from: now)

        let formatter = DateFormatter()
        formatter.dateFormat = sameYear ? "MMM d" : "MMM d, yyyy"
        return formatter.string(from: date)
    }
}

// MARK: - Filter Sheet

private struct CatalystFilterSheet: View {
    let availableFilters: [CatalystFilter]
    let selectedFilters: Set<CatalystFilter>
    let onApply: (Set<CatalystFilter>) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var localSelection: Set<CatalystFilter> = []

    var body: some View {
        NavigationStack {
            List {
                Section {
                    ForEach(availableFilters) { filter in
                        Button {
                            if localSelection.contains(filter) {
                                localSelection.remove(filter)
                            } else {
                                localSelection.insert(filter)
                            }
                        } label: {
                            HStack {
                                Image(systemName: filter.icon)
                                    .foregroundStyle(filter.color)
                                    .frame(width: 24)
                                Text(filter.label)
                                    .foregroundStyle(.primary)
                                Spacer()
                                if localSelection.contains(filter) {
                                    Image(systemName: "checkmark")
                                        .foregroundStyle(.blue)
                                }
                            }
                        }
                    }
                } header: {
                    Text("Show Events")
                }

                Section {
                    Button("Select All") {
                        localSelection = Set(availableFilters)
                    }
                    Button("Clear All") {
                        localSelection = []
                    }
                }
            }
            .navigationTitle("Filter Catalysts")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        dismiss()
                    }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Apply") {
                        onApply(localSelection)
                        dismiss()
                    }
                    .fontWeight(.semibold)
                }
            }
            .onAppear {
                localSelection = selectedFilters
            }
        }
    }
}

// MARK: - Filter Chip

private struct FilterChip: View {
    let filter: CatalystFilter
    let isSelected: Bool
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 5) {
                Image(systemName: filter.icon)
                    .font(.footnote)
                Text(filter.label)
                    .font(.footnote)
                    .fontWeight(.medium)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(isSelected ? Color.accentColor.opacity(0.15) : Color(.tertiarySystemFill))
            .foregroundStyle(isSelected ? Color.accentColor : .secondary)
            .clipShape(Capsule())
            .overlay(
                Capsule()
                    .strokeBorder(isSelected ? Color.accentColor : Color.clear, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Catalyst Event Row Link

private struct CatalystEventRowLink: View {
    let event: CatalystEvent
    var showSymbol: Bool = false
    var isPast: Bool = false
    @Environment(\.openURL) private var openURL

    var body: some View {
        if let url = event.sourceURL {
            Button {
                openURL(url)
            } label: {
                CatalystEventRow(event: event, showSymbol: showSymbol, isPast: isPast, hasLink: true)
            }
            .buttonStyle(.plain)
        } else {
            CatalystEventRow(event: event, showSymbol: showSymbol, isPast: isPast, hasLink: false)
        }
    }
}

// MARK: - Catalyst Event Row

private struct CatalystEventRow: View {
    let event: CatalystEvent
    var showSymbol: Bool = false
    var isPast: Bool = false
    var hasLink: Bool = false

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 10) {
                Image(systemName: event.eventType.icon)
                    .font(.subheadline)
                    .foregroundStyle(event.eventType.color)
                    .frame(width: 24)

                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: 4) {
                        if showSymbol {
                            Text(event.symbol)
                                .font(.subheadline)
                                .fontWeight(.semibold)
                                .foregroundStyle(.blue)
                        }
                        Text(event.title)
                            .font(.subheadline)
                            .lineLimit(1)
                    }

                    if let description = event.description {
                        Text(description)
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                    }
                }

                Spacer()

                VStack(alignment: .trailing, spacing: 2) {
                    Text(formatDate(event.date))
                        .font(.footnote)
                        .foregroundStyle(isPast ? .secondary : .primary)

                    if event.isEstimate {
                        Text("Est")
                            .font(.caption)
                            .padding(.horizontal, 5)
                            .padding(.vertical, 2)
                            .background(Color.orange.opacity(0.2))
                            .foregroundStyle(.orange)
                            .clipShape(Capsule())
                    }
                }

                Image(systemName: "arrow.up.right")
                    .font(.footnote)
                    .foregroundStyle(.tertiary)
                    .opacity(hasLink ? 1 : 0)
            }

            // Earnings performance history
            if let history = event.earningsHistory, !history.isEmpty {
                EarningsPerformanceRow(history: history)
            }

        }
        .padding(.vertical, 10)
        .opacity(isPast ? 0.7 : 1)
    }

    private func formatDate(_ dateStr: String) -> String {
        guard let date = DateFormatter.apiDate.date(from: dateStr) else { return dateStr }
        let now = Date()
        let sameYear = Calendar.current.component(.year, from: date) == Calendar.current.component(.year, from: now)

        let formatter = DateFormatter()
        formatter.dateFormat = sameYear ? "MMM d" : "MMM d, yyyy"
        return formatter.string(from: date)
    }
}

// MARK: - Earnings Performance Row

private struct EarningsPerformanceRow: View {
    let history: [EarningsHistoryEntry]

    var body: some View {
        HStack(spacing: 6) {
            ForEach(history.suffix(3)) { item in
                EarningsQuarterBadge(item: item)
                    .frame(maxWidth: .infinity)
            }
        }
    }
}

private struct EarningsQuarterBadge: View {
    let item: EarningsHistoryEntry

    private var backgroundColor: Color {
        guard let priceMove = item.priceMove else {
            return Color(.tertiarySystemFill)
        }
        let rounded = round(priceMove)
        if rounded == 0 {
            return Color(.tertiarySystemFill)
        }
        return rounded > 0 ? Color.green.opacity(0.15) : Color.red.opacity(0.15)
    }

    private var foregroundColor: Color {
        guard let priceMove = item.priceMove else {
            return .secondary
        }
        let rounded = round(priceMove)
        if rounded == 0 {
            return .secondary
        }
        return rounded > 0 ? .green : .red
    }

    var body: some View {
        HStack(spacing: 3) {
            Text(item.quarter)
                .foregroundStyle(.secondary)

            if let beat = item.beat {
                Image(systemName: beat ? "checkmark" : "xmark")
                    .font(.system(size: 10, weight: .bold))
                    .foregroundStyle(beat ? .green : .red)
            }

            if let priceMove = item.priceMove {
                Text(formatPriceMove(priceMove))
                    .foregroundStyle(foregroundColor)
            }
        }
        .font(.footnote)
        .frame(height: 26)
        .frame(maxWidth: .infinity)
        .background(backgroundColor)
        .clipShape(Capsule())
    }

    private func formatPriceMove(_ value: Double) -> String {
        let rounded = round(value)
        if rounded == 0 {
            return "0%"
        }
        let prefix = rounded > 0 ? "+" : ""
        return "\(prefix)\(Int(rounded))%"
    }
}

#Preview {
    CatalystsSection(
        catalystEvents: [
            CatalystEvent(
                id: "1",
                symbol: "AAPL",
                eventType: .earnings,
                date: "2024-02-01",
                dateEnd: nil,
                isEstimate: false,
                title: "Q1 2024 Earnings",
                description: "After market close",
                source: .yahoo,
                sourceUrl: nil,
                earningsHistory: [
                    EarningsHistoryEntry(date: "2024-01-15", beat: true, priceMove: 2.5),
                    EarningsHistoryEntry(date: "2023-10-15", beat: false, priceMove: -1.2),
                    EarningsHistoryEntry(date: "2023-07-15", beat: true, priceMove: 0.8),
                ],
                epsEstimate: nil,
                revenueEstimate: nil,
                insiderName: nil,
                insiderRelation: nil,
                insiderShares: nil,
                insiderValue: nil,
                secForm: nil,
                secItemCode: nil,
                trialPhases: nil
            ),
            CatalystEvent(
                id: "2",
                symbol: "AAPL",
                eventType: .exDividend,
                date: "2024-02-09",
                dateEnd: nil,
                isEstimate: true,
                title: "Ex-Dividend Date",
                description: "$0.24 per share",
                source: .yahoo,
                sourceUrl: nil,
                earningsHistory: nil,
                epsEstimate: nil,
                revenueEstimate: nil,
                insiderName: nil,
                insiderRelation: nil,
                insiderShares: nil,
                insiderValue: nil,
                secForm: nil,
                secItemCode: nil,
                trialPhases: nil
            )
        ],
        currentSymbol: "AAPL"
    )
    .padding()
    .background(Color.groupedBackground)
}
