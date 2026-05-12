import { type ProviderId, type SecretReference, makeProviderId } from "../types/providers";

export type SecretStoreErrorCode =
	| "invalid-secret-input"
	| "invalid-secret-reference"
	| "secret-not-found"
	| "write-in-flight";

export interface SecretStoreError {
	readonly code: SecretStoreErrorCode;
	readonly message: string;
	readonly field?: string;
}

export interface SecretStoreSuccess<TValue> {
	readonly ok: true;
	readonly value: TValue;
}

export interface SecretStoreFailure {
	readonly ok: false;
	readonly error: SecretStoreError;
}

export type SecretStoreResult<TValue> = SecretStoreSuccess<TValue> | SecretStoreFailure;

export interface SecretWriteInput {
	readonly providerId: ProviderId | string;
	readonly label: string;
	readonly value: string;
}

export interface ProviderSecretStore {
	save(input: SecretWriteInput): Promise<SecretStoreResult<SecretReference>>;
	read(reference: SecretReference): Promise<SecretStoreResult<string>>;
	delete(reference: SecretReference): Promise<SecretStoreResult<boolean>>;
	listReferences(): readonly SecretReference[];
}

export interface InMemoryProviderSecretStoreOptions {
	readonly beforeWrite?: () => Promise<void>;
	readonly now?: () => Date;
}

const success = <TValue>(value: TValue): SecretStoreSuccess<TValue> => ({ ok: true, value });

const failure = (code: SecretStoreErrorCode, message: string, field?: string): SecretStoreFailure => {
	if (field === undefined) {
		return { ok: false, error: { code, message } };
	}

	return { ok: false, error: { code, message, field } };
};

const readProviderId = (providerId: ProviderId | string): ProviderId | null => {
	if (typeof providerId !== "string" || providerId.trim().length === 0) {
		return null;
	}

	return makeProviderId(providerId.trim());
};

const normalizeLabel = (label: string): string | null => {
	const normalized = label.trim();

	if (normalized.length === 0) {
		return null;
	}

	return normalized;
};

const slugify = (value: string): string =>
	value
		.trim()
		.toLowerCase()
		.replaceAll(/[^a-z0-9]+/g, "-")
		.replaceAll(/^-|-$/g, "");

const createSecretReference = (providerId: ProviderId, label: string, now: Date): SecretReference => {
	const timestamp = now.toISOString();
	const labelSlug = slugify(label) || "credential";

	return {
		kind: "provider-secret",
		id: `provider-secret:${providerId}:${labelSlug}:${timestamp}`,
		providerId,
		label,
		createdAt: timestamp,
		updatedAt: timestamp,
	};
};

const validateReference = (reference: SecretReference): SecretStoreFailure | null => {
	if (reference.kind !== "provider-secret") {
		return failure("invalid-secret-reference", "Secret reference kind is unsupported.", "kind");
	}

	if (reference.id.trim().length === 0) {
		return failure("invalid-secret-reference", "Secret reference ID must be non-empty.", "id");
	}

	if (reference.providerId.trim().length === 0) {
		return failure("invalid-secret-reference", "Secret reference provider ID must be non-empty.", "providerId");
	}

	return null;
};

export class InMemoryProviderSecretStore implements ProviderSecretStore {
	private readonly valuesByReferenceId = new Map<string, string>();
	private readonly referencesById = new Map<string, SecretReference>();
	private readonly inFlightWriteKeys = new Set<string>();
	private readonly beforeWrite: (() => Promise<void>) | undefined;
	private readonly now: () => Date;

	constructor(options: InMemoryProviderSecretStoreOptions = {}) {
		this.beforeWrite = options.beforeWrite;
		this.now = options.now ?? (() => new Date());
	}

	async save(input: SecretWriteInput): Promise<SecretStoreResult<SecretReference>> {
		const providerId = readProviderId(input.providerId);
		if (providerId === null) {
			return failure("invalid-secret-input", "providerId must be a non-empty string.", "providerId");
		}

		const label = normalizeLabel(input.label);
		if (label === null) {
			return failure("invalid-secret-input", "label must be a non-empty string.", "label");
		}

		if (typeof input.value !== "string" || input.value.length === 0) {
			return failure("invalid-secret-input", "value must be a non-empty runtime credential.", "value");
		}

		const writeKey = `${providerId}:${label}`;
		if (this.inFlightWriteKeys.has(writeKey)) {
			return failure("write-in-flight", "A credential write for this provider and label is already running.");
		}

		this.inFlightWriteKeys.add(writeKey);
		try {
			await this.beforeWrite?.();
			const reference = createSecretReference(providerId, label, this.now());
			this.valuesByReferenceId.set(reference.id, input.value);
			this.referencesById.set(reference.id, reference);

			return success(reference);
		} finally {
			this.inFlightWriteKeys.delete(writeKey);
		}
	}

	async read(reference: SecretReference): Promise<SecretStoreResult<string>> {
		const referenceError = validateReference(reference);
		if (referenceError !== null) {
			return referenceError;
		}

		const value = this.valuesByReferenceId.get(reference.id);
		if (value === undefined) {
			return failure("secret-not-found", "No runtime credential exists for the requested reference.", "id");
		}

		return success(value);
	}

	async delete(reference: SecretReference): Promise<SecretStoreResult<boolean>> {
		const referenceError = validateReference(reference);
		if (referenceError !== null) {
			return referenceError;
		}

		const didDeleteValue = this.valuesByReferenceId.delete(reference.id);
		const didDeleteReference = this.referencesById.delete(reference.id);

		return success(didDeleteValue || didDeleteReference);
	}

	listReferences(): readonly SecretReference[] {
		return [...this.referencesById.values()].sort((left, right) =>
			left.id.localeCompare(right.id, "en", { sensitivity: "base" }),
		);
	}
}

export const createInMemoryProviderSecretStore = (options?: InMemoryProviderSecretStoreOptions): ProviderSecretStore =>
	new InMemoryProviderSecretStore(options);
