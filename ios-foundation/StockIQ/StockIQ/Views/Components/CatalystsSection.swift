// CatalystsSection.swift
// StockIQ

import SwiftUI

struct CatalystsSection: View {
    let catalystEvents: [CatalystEvent]
    var currentSymbol: String? = nil

    @State private var isExpanded = true

    private var futureEvents: [CatalystEvent] {
        let oneYearFromNow = Calendar.current.date(byAdding: .year, value: 1, to: Date()) ?? Date()
        return catalystEvents
            .filter { $0.isFuture && ($0.eventDate ?? Date()) <= oneYearFromNow }
            .sorted { ($0.eventDate ?? Date()) < ($1.eventDate ?? Date()) }
    }

    private var recentPastEvents: [CatalystEvent] {
        let sixtyDaysAgo = Calendar.current.date(byAdding: .day, value: -60, to: Date()) ?? Date()
        return catalystEvents
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

    var body: some View {
        if futureEvents.isEmpty && recentPastEvents.isEmpty {
            EmptyView()
        } else {
            DisclosureGroup(isExpanded: $isExpanded) {
                VStack(alignment: .leading, spacing: 8) {
                    if !futureEvents.isEmpty {
                        Text("Upcoming")
                            .font(.caption)
                            .fontWeight(.semibold)
                            .foregroundStyle(.secondary)
                            .padding(.top, 8)

                        ForEach(futureEvents) { event in
                            CatalystEventRow(event: event, showSymbol: currentSymbol == nil)
                        }
                    }

                    if !recentPastEvents.isEmpty {
                        Text("Past")
                            .font(.caption)
                            .fontWeight(.semibold)
                            .foregroundStyle(.secondary)
                            .padding(.top, futureEvents.isEmpty ? 8 : 4)

                        ForEach(recentPastEvents) { event in
                            CatalystEventRow(event: event, showSymbol: currentSymbol == nil, isPast: true)
                        }
                    }
                }
            } label: {
                HStack {
                    Text("Catalysts")
                        .font(.headline)
                    Spacer()
                    if let summary = summary {
                        Text(summary)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
            }
            .padding()
            .background(Color(.secondarySystemGroupedBackground))
            .clipShape(RoundedRectangle(cornerRadius: 12))
            .padding(.horizontal)
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

// MARK: - Catalyst Event Row

private struct CatalystEventRow: View {
    let event: CatalystEvent
    var showSymbol: Bool = false
    var isPast: Bool = false

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: event.eventType.icon)
                .font(.caption)
                .foregroundStyle(event.eventType.color)
                .frame(width: 20)

            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 4) {
                    if showSymbol {
                        Text(event.symbol)
                            .font(.caption)
                            .fontWeight(.semibold)
                            .foregroundStyle(.blue)
                    }
                    Text(event.title)
                        .font(.caption)
                        .lineLimit(1)
                }

                if let description = event.description {
                    Text(description)
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
            }

            Spacer()

            VStack(alignment: .trailing, spacing: 2) {
                Text(formatDate(event.date))
                    .font(.caption2)
                    .foregroundStyle(isPast ? .secondary : .primary)

                if event.isEstimate {
                    Text("Est")
                        .font(.caption2)
                        .padding(.horizontal, 4)
                        .padding(.vertical, 1)
                        .background(Color.orange.opacity(0.2))
                        .foregroundStyle(.orange)
                        .clipShape(Capsule())
                }
            }
        }
        .padding(.vertical, 4)
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
                metadata: nil
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
                metadata: nil
            )
        ],
        currentSymbol: "AAPL"
    )
    .padding()
    .background(Color.groupedBackground)
}
