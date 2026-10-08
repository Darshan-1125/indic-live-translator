from .engine import StabilityEngine


def main():
    engine = StabilityEngine()

    asr_partials = [
        "Naan",
        "Naan meeting",
        "Naan meeting-ku",
        "Naan meeting-ku late",
        "Naan meeting-ku late aagiten",
    ]

    print("=== Stability Engine Streaming Demo ===\n")

    for partial in asr_partials:
        result = engine.process_partial(partial)

        print(f"ASR:        {partial}")
        print(f"Committed:  {result.cumulative_committed_text}")
        print(f"Tentative:  {result.tentative_text}")
        print(f"New commit: {result.newly_committed_text}")
        print("-" * 50)


if __name__ == "__main__":
    main()
