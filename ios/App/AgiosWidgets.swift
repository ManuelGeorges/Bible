import WidgetKit
import SwiftUI

struct WidgetProvider {
    static let groupID = "group.com.agios.bible"

    static func value(for key: String, default val: String) -> String {
        return UserDefaults(suiteName: groupID)?.string(forKey: key) ?? val
    }

    static func doubleValue(for key: String, default val: Double) -> Double {
        if let str = UserDefaults(suiteName: groupID)?.string(forKey: key), let d = Double(str) {
            return d
        }
        return val
    }
    
    static func hasValue(for key: String) -> Bool {
        return UserDefaults(suiteName: groupID)?.object(forKey: key) != nil
    }
}

struct AgiosColors {
    static let bg = Color(UIColor { (traits) -> UIColor in
        return traits.userInterfaceStyle == .dark ? UIColor(red: 0.10, green: 0.11, blue: 0.12, alpha: 1.0) : .white
    })
    static let text = Color(UIColor { (traits) -> UIColor in
        return traits.userInterfaceStyle == .dark ? .white : UIColor(red: 0.06, green: 0.09, blue: 0.16, alpha: 1.0)
    })
    static let secondaryText = Color(red: 0.58, green: 0.64, blue: 0.72)

    static let verseAccent = Color(red: 0.23, green: 0.51, blue: 0.96)
    static let planAccent = Color(red: 0.93, green: 0.28, blue: 0.60)
    static let questionAccent = Color(red: 0.06, green: 0.73, blue: 0.51)
    static let pointsAccent = Color(red: 0.96, green: 0.62, blue: 0.04)
}

struct WidgetHeader: View {
    let title: String
    let color: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title)
                .font(.system(size: 13, weight: .bold))
                .foregroundColor(color)
            Rectangle()
                .fill(color)
                .frame(width: 32, height: 2.5)
        }
    }
}

struct VerseWidgetView: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            WidgetHeader(title: "آية اليوم 📖", color: AgiosColors.verseAccent)
            Spacer()
            Text(WidgetProvider.value(for: "verse_text", default: "اُدْعُنِي فِي يَوْمِ الضِّيقِ أُنْقِذْكَ فَتُمَجِّدَنِي."))
                .font(.system(size: 18, weight: .bold))
                .foregroundColor(AgiosColors.text)
                .multilineTextAlignment(.center)
                .minimumScaleFactor(0.5)
                .frame(maxWidth: .infinity)
            Spacer()
            Text(WidgetProvider.value(for: "verse_ref", default: "(مزمور 15:50)"))
                .font(.system(size: 11))
                .foregroundColor(AgiosColors.secondaryText)
                .frame(maxWidth: .infinity)
        }
        .padding(16)
        .background(AgiosColors.bg)
    }
}

struct PlanWidgetView: View {
    var hasPlan: Bool {
        return WidgetProvider.hasValue(for: "plan_title")
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            WidgetHeader(title: "خطة القراءة 📑", color: AgiosColors.planAccent)
            Spacer()
            
            if hasPlan {
                VStack(alignment: .leading, spacing: 6) {
                    Text(WidgetProvider.value(for: "plan_title", default: ""))
                        .font(.system(size: 14, weight: .bold))
                        .foregroundColor(AgiosColors.text)
                        .lineLimit(1)

                    GeometryReader { geo in
                        ZStack(alignment: .leading) {
                            RoundedRectangle(cornerRadius: 5)
                                .fill(AgiosColors.planAccent.opacity(0.15))
                                .frame(height: 8)
                            RoundedRectangle(cornerRadius: 5)
                                .fill(AgiosColors.planAccent)
                                .frame(width: geo.size.width * CGFloat(WidgetProvider.doubleValue(for: "plan_progress", default: 0.0) / 100.0), height: 8)
                        }
                    }
                    .frame(height: 8)

                    HStack {
                        Text("%" + WidgetProvider.value(for: "plan_progress", default: "0"))
                            .font(.system(size: 11, weight: .bold))
                            .foregroundColor(AgiosColors.planAccent)
                        Spacer()
                        Text(WidgetProvider.value(for: "plan_remaining", default: ""))
                            .font(.system(size: 11))
                            .foregroundColor(AgiosColors.secondaryText)
                    }
                }
            } else {
                Text("ليس لديك خطط جارية حالياً")
                    .font(.system(size: 13))
                    .foregroundColor(AgiosColors.secondaryText)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: .infinity)
            }
            Spacer()
        }
        .padding(16)
        .background(AgiosColors.bg)
    }
}

struct QuestionWidgetView: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            WidgetHeader(title: "سؤال اليوم ❓", color: AgiosColors.questionAccent)
            Spacer()
            Text(WidgetProvider.value(for: "question_text", default: "من هو النبي الذي دخل جوف الحوت؟"))
                .font(.system(size: 15, weight: .bold))
                .foregroundColor(AgiosColors.text)
                .multilineTextAlignment(.center)
                .minimumScaleFactor(0.5)
                .frame(maxWidth: .infinity)
            Spacer()
            Text("التفاصيل")
                .font(.system(size: 12, weight: .bold))
                .padding(.horizontal, 20)
                .padding(.vertical, 6)
                .background(AgiosColors.questionAccent.opacity(0.15))
                .foregroundColor(AgiosColors.questionAccent)
                .cornerRadius(10)
                .frame(maxWidth: .infinity)
        }
        .padding(16)
        .background(AgiosColors.bg)
    }
}

struct PointsWidgetView: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            WidgetHeader(title: "النقاط والـ Streak 🔥", color: AgiosColors.pointsAccent)
            Spacer()
            VStack(spacing: 0) {
                Text(WidgetProvider.value(for: "points_total", default: "17660"))
                    .font(.system(size: 32, weight: .bold))
                    .foregroundColor(AgiosColors.text)
                    .minimumScaleFactor(0.5)
                Text("نقطة")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundColor(AgiosColors.secondaryText)
            }
            .frame(maxWidth: .infinity)
            Spacer()
            Text("سلسلة تفاعل: " + WidgetProvider.value(for: "streak_days", default: "9") + " يوم")
                .font(.system(size: 10, weight: .bold))
                .padding(.horizontal, 10)
                .padding(.vertical, 4)
                .background(AgiosColors.pointsAccent.opacity(0.15))
                .foregroundColor(AgiosColors.pointsAccent)
                .cornerRadius(8)
                .frame(maxWidth: .infinity)
        }
        .padding(16)
        .background(AgiosColors.bg)
    }
}

@main
struct AgiosWidgetsBundle: WidgetBundle {
    var body: some Widget {
        VerseWidget()
        PlanWidget()
        QuestionWidget()
        PointsWidget()
    }
}

struct VerseWidget: Widget {
    let kind: String = "AgiosVerseWidget"
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: Provider()) { _ in VerseWidgetView() }
        .configurationDisplayName("آية اليوم")
        .description("عرض آية اليوم.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

struct PlanWidget: Widget {
    let kind: String = "AgiosPlanWidget"
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: Provider()) { _ in PlanWidgetView() }
        .configurationDisplayName("خطة القراءة")
        .description("متابعة خطتك الحالية.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

struct QuestionWidget: Widget {
    let kind: String = "AgiosQuestionWidget"
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: Provider()) { _ in QuestionWidgetView() }
        .configurationDisplayName("سؤال اليوم")
        .description("سؤال جديد كل يوم.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

struct PointsWidget: Widget {
    let kind: String = "AgiosPointsWidget"
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: Provider()) { _ in PointsWidgetView() }
        .configurationDisplayName("النقاط")
        .description("عرض نقاطك وسلسلة تفاعلك.")
        .supportedFamilies([.systemSmall])
    }
}

struct Provider: TimelineProvider {
    func placeholder(in context: Context) -> SimpleEntry { SimpleEntry() }
    func getSnapshot(in context: Context, completion: @escaping (SimpleEntry) -> ()) { completion(SimpleEntry()) }
    func getTimeline(in context: Context, completion: @escaping (Timeline<SimpleEntry>) -> ()) {
        completion(Timeline(entries: [SimpleEntry()], policy: .atEnd))
    }
}

struct SimpleEntry: TimelineEntry { let date: Date = Date() }