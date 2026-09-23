# Shared constants and utilities for skill health checker rules.

STOPWORDS = {
    "the", "a", "an", "this", "that", "these", "those", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "to", "for", "of", "in", "on", "at", "by", "with", "about",
    "against", "between", "into", "through", "during", "before", "after", "above", "below", "to", "from",
    "up", "down", "in", "out", "on", "off", "over", "under", "again", "further", "then", "once", "here",
    "there", "when", "where", "why", "how", "all", "any", "both", "each", "few", "more", "most", "other",
    "some", "such", "no", "nor", "not", "only", "own", "same", "so", "than", "too", "very", "s", "t", "can",
    "will", "just", "don", "should", "shouldn", "now", "d", "ll", "m", "o", "re", "ve", "y", "ain", "aren",
    "couldn", "didn", "doesn", "hadn", "hasn", "haven", "isn", "ma", "mightn", "mustn", "needn", "shan",
    "shouldn", "wasn", "weren", "won", "wouldn"
}

# Extended stopwords for IQ-001 contradiction detection (includes domain-specific noise words)
IQ_STOPWORDS = STOPWORDS | {
    "agent", "user", "skill", "file", "code", "run", "make",
    "always", "never", "must", "ensure", "guarantee", "require", "strictly", "avoid", "forbidden", "prohibited",
    "rules", "scripts", "section", "check", "report", "failure", "detail", "incorrect", "correct", "subject",
    "imperative", "contradictory", "instructions", "instruction", "paragraph", "sentences", "sentence",
    "document", "marker", "markers", "placeholder", "placeholders", "manifest", "version", "versions",
    "syntax", "language", "bash", "python", "script"
}
