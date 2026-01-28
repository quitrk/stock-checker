// ChecklistItemRow.swift
// StockIQ

import SwiftUI

struct ChecklistItemRow: View {
    let item: ChecklistItem

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: item.status.icon)
                .font(.body)
                .foregroundStyle(item.status.color)
                .frame(width: 20)
                .accessibilityHidden(true)

            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(item.label)
                        .font(.subheadline)
                        .foregroundStyle(.primary)

                    Spacer()

                    Text(item.displayValue)
                        .font(.subheadline)
                        .fontWeight(.medium)
                        .foregroundStyle(item.status.color)
                }

                Text(item.description)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)

                if let thresholds = item.thresholds {
                    ThresholdsView(thresholds: thresholds)
                }
            }
        }
        .padding(.vertical, 8)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(item.label), \(item.displayValue)")
        .accessibilityValue(item.status.accessibilityDescription)
    }
}

// MARK: - Thresholds View

struct ThresholdsView: View {
    let thresholds: ChecklistItem.Thresholds

    var body: some View {
        HStack(spacing: 12) {
            thresholdLabel("Safe", thresholds.safe, .green)
            thresholdLabel("Warning", thresholds.warning, .orange)
            thresholdLabel("Danger", thresholds.danger, .red)
        }
        .font(.caption2)
        .padding(.top, 4)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Thresholds: Safe \(thresholds.safe), Warning \(thresholds.warning), Danger \(thresholds.danger)")
    }

    private func thresholdLabel(_ title: String, _ value: String, _ color: Color) -> some View {
        HStack(spacing: 2) {
            Circle()
                .fill(color.opacity(0.3))
                .frame(width: 6, height: 6)
            Text(value)
                .foregroundStyle(.tertiary)
        }
        .accessibilityHidden(true)
    }
}

#Preview {
    VStack {
        ChecklistItemRow(item: ChecklistItem(
            id: "test",
            label: "Volume vs 90-Day Median",
            description: "Current volume compared to typical daily volume.",
            value: .double(5.2),
            displayValue: "5.2x",
            status: .warning,
            thresholds: ChecklistItem.Thresholds(
                safe: "< 5x",
                warning: "5-20x",
                danger: "20x+"
            )
        ))
        Divider()
        ChecklistItemRow(item: ChecklistItem(
            id: "test2",
            label: "Stock Price Level",
            description: "Stocks below $1 face delisting risk.",
            value: .double(248.04),
            displayValue: "$248.04",
            status: .safe,
            thresholds: nil
        ))
    }
    .padding()
}
