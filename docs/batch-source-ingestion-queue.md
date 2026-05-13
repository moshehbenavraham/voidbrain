# Batch Source Ingestion Queue

`voidbrain.ingest-source` can process a bounded batch of approved markdown,
text, pasted, or URL source records. The queue preserves deterministic item
order while workers run with bounded concurrency.

Each item records a stable item ID, source path, target paths, provider
decision, citation state, staged-change IDs, validation output, and retry
guidance. Status values are queued, running, staged, failed, canceled, and
skipped.

Provider-assisted extraction is reviewed per item before private source content
can leave local runtime. Provider denial fails closed for that item and does not
stage generated notes. Generated source, entity, concept, and summary notes
continue through staged changes only.

Cancellation stops queued work and requests abort for running work. Retry is
item-scoped and should be used after resolving provider, duplicate, citation,
or target-path diagnostics.

Hot cache queue records are recovery support records. They store queue IDs,
item IDs, counts, bounded source and target paths, provider decisions,
staged-change IDs, validation output, and retry guidance. They do not store raw
source bodies, provider secrets, authorization headers, or hidden provider
state.
