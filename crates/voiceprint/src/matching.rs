//! Closed-set matching of unlabeled speaker clusters to enrolled humans.

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct SpeakerKey {
    pub channel: i32,
    pub speaker_index: Option<i32>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct ScoredPair {
    pub speaker: SpeakerKey,
    pub human_id: String,
    pub score: f32,
}

#[derive(Debug, Clone, PartialEq)]
pub struct VoiceprintMatch {
    pub speaker: SpeakerKey,
    pub human_id: String,
    pub score: f32,
    pub runner_up_score: Option<f32>,
}

pub fn cosine_similarity(left: &[f32], right: &[f32]) -> Option<f32> {
    if left.len() != right.len() || left.is_empty() {
        return None;
    }

    let mut dot = 0.0f32;
    let mut left_norm = 0.0f32;
    let mut right_norm = 0.0f32;
    for (a, b) in left.iter().zip(right) {
        if !a.is_finite() || !b.is_finite() {
            return None;
        }
        dot += a * b;
        left_norm += a * a;
        right_norm += b * b;
    }

    if left_norm <= 0.0 || right_norm <= 0.0 {
        return None;
    }

    Some((dot / (left_norm.sqrt() * right_norm.sqrt())).clamp(-1.0, 1.0))
}

pub fn mean_embedding(embeddings: &[Vec<f32>]) -> Option<Vec<f32>> {
    let dim = embeddings.first()?.len();
    if dim == 0 || embeddings.iter().any(|embedding| embedding.len() != dim) {
        return None;
    }

    let mut acc = vec![0.0f32; dim];
    let mut count = 0.0f32;
    for embedding in embeddings {
        if embedding.iter().any(|value| !value.is_finite()) {
            continue;
        }
        for (slot, value) in acc.iter_mut().zip(embedding) {
            *slot += value;
        }
        count += 1.0;
    }
    if count <= 0.0 {
        return None;
    }
    for value in &mut acc {
        *value /= count;
    }
    l2_normalize(&mut acc);
    Some(acc)
}

/// Assigns each cluster and each human at most once, highest cosine first.
/// `runner_up_score` is the cluster's next-best human from the original scores.
pub fn greedy_unique_matches(pairs: &[ScoredPair]) -> Vec<VoiceprintMatch> {
    let mut ranked = pairs.to_vec();
    ranked.sort_by(|left, right| {
        right
            .score
            .partial_cmp(&left.score)
            .unwrap_or(std::cmp::Ordering::Equal)
            .then_with(|| left.human_id.cmp(&right.human_id))
            .then_with(|| left.speaker.channel.cmp(&right.speaker.channel))
            .then_with(|| left.speaker.speaker_index.cmp(&right.speaker.speaker_index))
    });

    let mut used_speakers = std::collections::HashSet::new();
    let mut used_humans = std::collections::HashSet::new();
    let mut matches = Vec::new();

    for pair in ranked {
        if used_speakers.contains(&pair.speaker) || used_humans.contains(&pair.human_id) {
            continue;
        }
        used_speakers.insert(pair.speaker);
        used_humans.insert(pair.human_id.clone());

        let runner_up_score = pairs
            .iter()
            .filter(|candidate| {
                candidate.speaker == pair.speaker && candidate.human_id != pair.human_id
            })
            .map(|candidate| candidate.score)
            .max_by(|left, right| left.partial_cmp(right).unwrap_or(std::cmp::Ordering::Equal));

        matches.push(VoiceprintMatch {
            speaker: pair.speaker,
            human_id: pair.human_id,
            score: pair.score,
            runner_up_score,
        });
    }

    matches
}

fn l2_normalize(values: &mut [f32]) {
    let norm = values.iter().map(|value| value * value).sum::<f32>().sqrt();
    if norm <= 0.0 {
        return;
    }
    for value in values {
        *value /= norm;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn pair(channel: i32, speaker_index: i32, human_id: &str, score: f32) -> ScoredPair {
        ScoredPair {
            speaker: SpeakerKey {
                channel,
                speaker_index: Some(speaker_index),
            },
            human_id: human_id.to_string(),
            score,
        }
    }

    #[test]
    fn cosine_is_one_for_identical_vectors() {
        assert_eq!(
            cosine_similarity(&[0.0, 1.0, 0.0], &[0.0, 1.0, 0.0]),
            Some(1.0)
        );
    }

    #[test]
    fn cosine_rejects_mismatched_or_zero_vectors() {
        assert_eq!(cosine_similarity(&[1.0], &[1.0, 0.0]), None);
        assert_eq!(cosine_similarity(&[0.0, 0.0], &[1.0, 0.0]), None);
        assert_eq!(cosine_similarity(&[f32::NAN, 1.0], &[0.0, 1.0]), None);
    }

    #[test]
    fn mean_embedding_averages_and_normalizes() {
        let mean = mean_embedding(&[vec![3.0, 0.0], vec![0.0, 4.0]]).unwrap();
        let expected_norm = 1.5_f32.hypot(2.0);
        assert!((mean[0] - 1.5 / expected_norm).abs() < 1e-6);
        assert!((mean[1] - 2.0 / expected_norm).abs() < 1e-6);
    }

    #[test]
    fn greedy_unique_keeps_the_strongest_pair_and_reports_margin() {
        let matches = greedy_unique_matches(&[
            pair(2, 0, "ada", 0.91),
            pair(2, 0, "bob", 0.80),
            pair(2, 1, "ada", 0.88),
            pair(2, 1, "bob", 0.72),
        ]);

        assert_eq!(matches.len(), 2);
        assert_eq!(matches[0].human_id, "ada");
        assert_eq!(matches[0].speaker.speaker_index, Some(0));
        assert_eq!(matches[0].runner_up_score, Some(0.80));
        assert_eq!(matches[1].human_id, "bob");
        assert_eq!(matches[1].speaker.speaker_index, Some(1));
        assert_eq!(matches[1].runner_up_score, Some(0.88));
    }
}
