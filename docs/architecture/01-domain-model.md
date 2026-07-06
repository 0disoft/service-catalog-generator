# Domain Model

Status: Draft

## Source of Truth

- Product decision: docs/product/02-spec.md
- Architecture decisions: docs/adr/0003-single-public-monorepo.md and docs/adr/0005-service-manifest-schema-v1alpha1.md
- Technical owner: 0disoft

## Boundary

The domain model describes manifest-owned catalog data and derived scan results. It does not model
hosted portal accounts, login sessions, RBAC grants, incident workflows, cloud resources, Terraform
state, Kubernetes objects, or cost ledgers.

## Core Models

| Model | Meaning | Source |
| --- | --- | --- |
| `ServiceManifest` | Raw checked-in `service.yaml` owned by a service repository. | Manifest file |
| `CatalogSnapshot` | Normalized result of one scan. | Derived |
| `ServiceRecord` | One normalized service entry. | Derived from manifest |
| `OwnerRef` | Owner reference such as team, group, user, or system. | Manifest field |
| `RepositoryRef` | Repository provider and slug or URL. | Manifest field |
| `RuntimeProfile` | Language, platform, and optional framework. | Manifest field |
| `DeployTarget` | Deployment kind and environment references. | Manifest field |
| `DataProfile` | Data classification and personal-data declaration. | Manifest field |
| `DependencyRef` | Declared dependency on a service, API, database, queue, or external system. | Manifest field |
| `Diagnostic` | Error, warning, or info emitted by validation. | Derived |
| `GraphEdge` | Directed relationship from a service to a dependency target. | Derived |
| `CatalogPolicy` | Scan and validation policy such as unknown dependency handling. | Config/defaults |

## Manifest Shape

The first schema version is `scg.service/v1alpha1`. Initial manifests should stay mostly flat so a
small team can write them without adopting a large taxonomy first.

Required fields:

- `schemaVersion`
- `id`
- `name`
- `lifecycle`
- `owner.type`
- `owner.ref`
- `repository`
- `runtime`
- `deploy`
- `data.classification`
- `metadata.lastReviewedAt`

Optional fields may improve report quality, but optional absence cannot prevent catalog generation
unless policy explicitly promotes the diagnostic to an error.

## Owner References

Owner references should prefer stable refs such as `team:platform`, `group:infra`, or `user:zerodi`.
Real personal email addresses are not accepted as the default owner identity because generated
reports may be copied outside their original context.

## Dependency References

Dependencies are explicit declarations. The MVP must not infer dependencies from source imports,
cloud inventory, Terraform state, Kubernetes objects, logs, traces, or package manifests.

`dependencies: []` is valid and means the owner has reviewed the service and found no declared
dependencies.

## Derived Data

`CatalogSnapshot`, `ServiceRecord`, `Diagnostic`, and `GraphEdge` are generated views. They may be
written as JSON, DOT, or HTML, but editing those outputs must never be accepted as a way to fix
catalog facts.
