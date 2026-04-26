use super::*;

pub(crate) fn tier_name(tier: Tier) -> &'static str {
    match tier {
        Tier::EventCountUnsafeGt => "event-count-unsafe-gt",
        Tier::EventCountByteLoop => "event-count-byte-loop",
        Tier::EventCountSkipQuotes => "event-count-skip-quotes",
        Tier::EventCountNoText => "event-count-no-text",
        Tier::EventCountNoChecksum => "event-count-no-checksum",
        Tier::EventCountNoTextNoChecksum => "event-count-no-text-no-checksum",
        Tier::EventCountTwoStage => "event-count-two-stage",
        Tier::EventCountAutoStage => "event-count-auto-stage",
        Tier::EventCountUnchecked => "event-count-unchecked",
        Tier::EventCountOnly => "event-count-only",
        Tier::CountOnly => "count-only",
        Tier::CountEqTwoStage => "count-eq-two-stage",
        Tier::CountAutoStage => "count-auto-stage",
        Tier::NameStringOnly => "name-string-only",
        Tier::TextStringOnly => "text-string-only",
        Tier::AttrValueStringOnly => "attr-value-string-only",
        Tier::FullStringDirect => "full-string-direct",
        Tier::EventObjectFull => "event-object-full",
    }
}
