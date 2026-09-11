# A3.1 — Database Diagram Set (Playnex)

**COSC3060 Web Programming Studio · Assessment 3.1 — Database**
**Project:** Playnex · **Repository:** github.com/s4113887rmit/Playnex
**Student:** Nguyen Ngoc Quang Dang · S4113887

This folder is self-contained and sits beside the other folders in `WebDesign`.
It holds one image file per diagram, in a single format (PNG), plus this index.

---

## Contents

| # | File | Title |
|---|------|-------|
| 1 | `01-complete-erd.png` | Complete database diagram (ERD) |
| 2 | `02-relationship-diagram.png` | Relationship diagram |
| 3 | `03-embedding-and-duplication.png` | Embedding, referencing and duplication |
| 4 | `04-module-scope.png` | Module scope of the database |
| 5 | `05-indexes-and-query-support.png` | Indexes and query support |
| 6 | `06-schema-vs-implementation.png` | Schema against the live implementation |
| 7 | `07-purchase-rule-support.png` | How the schema supports the purchase rules |

---

### 1 · Complete database diagram (ERD)

Every collection, field, data type, index and relationship in the `playnex` database.
The nine collections are laid out in four labelled groups — *User account & taxonomy*,
*Storefront (assigned module)*, *Catalogue*, and *Blog & Forum (other modules)* — so the
whole codebase is represented, not only the storefront module.

Each box carries a `PK` tag, `unique` tags, `ref User` tags on the four fields that declare
a Mongoose reference, and a relationship footer. The panel at the bottom is a
**relationship index** listing all twelve connections with their cardinality; the same
links are drawn as lines in diagram 2.

### 2 · Relationship diagram

Every relationship classified as one-to-one, one-to-many or many-to-many, and marked as
either a **declared Mongoose reference** (`ref: "User"`) or an **application-level
reference** (a plain String id resolved in code). It also lists the stored identifiers that
are *not* traversable relationships (`threads.game`, `games.reviews[].authorId`).

### 3 · Embedding, referencing and duplication

Which child records are embedded inside their parent (`games.reviews[]`, `blogs.comments[]`,
`threads.replies[]`, `carts.items[]`, `wishlists.items[] + removedItems[]`,
`orders.items[] + shippingInfo + paymentInfo`), which are referenced by id, and the rules
that keep duplication to the two deliberate cases.

### 4 · Module scope of the database

Which collections belong to the assigned storefront module, which belong to the shared
User Account module, and which belong to the other team modules — with the reasoning for
why the storefront needs all five of its collections.

### 5 · Indexes and query support

All 22 declared indexes plus the default `_id` index, with the read, filter, sort or search
operation each one supports, and where it is used.

### 6 · Schema against the live implementation

Document counts and sample values read from the live database, next to the consistency
findings from comparing the declared schemas with actual behaviour.

### 7 · How the schema supports the purchase rules

Each rule the storefront added, mapped to the field or the index that serves it: the
once-per-account digital rule, server-side voucher re-validation, clearing a wishlist in one
action, and the `sale` filter excluding free giveaways. It records that the rules needed **no
new collection and no new index** — only one added field, `orders.items[].category`.

---

## Database at a glance

- **9 collections** — `users`, `carts`, `wishlists`, `orders`, `products`, `games`, `blogs`, `threads`, `categories`
- **235 documents** in total across the nine collections (most carts and wishlists are empty per-browser guest documents)
- **22 declared indexes** plus the default `_id` index on every collection
- **7 unique indexes** — `users.username`, `users.email`, `products.id`, `games.id`, `categories.slug`, `carts.userId`, `wishlists.userId`
- **3 text indexes** — `products`, `games`, `blogs` (and `threads` for title/content)
- **1 compound index** — `orders { userId: 1, createdAt: -1 }`
- **4 fields declare `ref: "User"`** — `blogs.authorId`, `blogs.comments[].authorId`, `threads.authorId`, `threads.replies[].authorId`
- **1 embedded-array-only design** — there is no separate collection for cart items, wishlist items, order items, reviews, comments or replies

## Consistency finding carried into diagram 6

`blogs.authorId` is declared as an `ObjectId` with `ref: "User"`, but `routes/blogs.js`
compares it with `post.authorId !== String(user._id)`. An `ObjectId` never strictly equals a
string, so the comparison is always true and the post owner is refused with `403` on both
edit and delete. `blogs.comments[].authorId` has the same mismatch. This is recorded as a
`risk` in diagram 6.

---

## Provenance

Every field, type, constraint, index and relationship in these diagrams was read from the
repository — `models/`, `routes/`, `middleware/`, `server.js`, `data/store.js` and the seed
scripts — and the counts, indexes and `unique` flags were verified by reading the live
`playnex` database through the application's configured `MONGODB_URI`.

No schema or relationship in these diagrams was invented, and no application source file was
modified to produce them.
