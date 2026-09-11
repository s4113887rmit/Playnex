# Playnex - Group Project

Playnex is a digital games and physical merchandise storefront. Browse games, add items to your cart or wishlist, participate in community discussions, and manage your profile.

## Team Members

| Full Name | Student ID | Module |
|-----------|-----------|--------|
| Ngo Gia Bao | S4186655 | Game Rating, Site Map |
| Nguyen Ngoc Quang Dang | S4113887 | shopping, cart, homepage, wishlist, checkout, confirmation |
| Tran Binh An | S4206755 | Discussion Forums, Administration Page |
| Nguyen Khanh Nguyen | S4197203 | Blogs, User Account |

## File and Folder Distribution

### Ngo Gia Bao (S4186655)
- `views/rating.ejs` - Browse games with search, sorting, and average star ratings
- `views/ratinggame.ejs` - Game review details with rating breakdown and user reviews
- `views/writegamereview.ejs` - Submit a star rating and written review for a game
- `views/sitemap.ejs` - Automatically generated sitemap
- `data/games.json` - Game and review seed data
- `views/partials/header.ejs`, `views/partials/footer.ejs` - Shared EJS header and footer partials

### Nguyen Ngoc Quang Dang (S4113887)
- `homepage.html` - Landing page with hero carousel, new releases, merch shelves
- `shopping.html` - Product catalog with filters, sorting, pagination
- `cart.html` - Shopping cart with quantity controls and order summary
- `checkout.html` - Delivery and payment form
- `confirmation.html` - Order confirmation page
- `wishlist.html` - Saved items with purchased/favorited sections
- `views/listing.ejs` - Game detail page (hero, facts, related games; mostly Dang, game review section by Bao)
- `public/js/listing.js` - Add to cart / wishlist wiring for the listing page
- `routes/products.js`, `routes/cart.js`, `routes/wishlist.js`, `routes/checkout.js` - Store APIs
- `data/products.js` - Product seed catalogue
- `data/store.js` - MongoDB-backed cart, wishlist and order data store with item statistics
- `public/js/homepage.js`, `shopping.js`, `cart.js`, `wishlist.js`, `checkout.js`, `confirmation.js` - Client scripts
- `style.css` - Global stylesheet (shared)

### Tran Binh An (S4206755)
- `forum.html` - Main thread list and category filters
- `forum-detail.html` - Detailed view of a single thread and replies
- `forum-create.html` - Form to create or edit a discussion post
- `admin.html` - Administrator dashboard for managing locked/normal accounts
- `admin-detail.html` - Detailed user moderation view with flags and purchase history
- `public/js/forum-render.js`, `forum-detail.js`, `forum-create.js` - Forum client scripts
- `public/js/admin-render.js`, `admin-search.js`, `admin-detail.js` - Admin client scripts
- `routes/threads.js` - Forum API (threads, replies, ownership checks) backed by MongoDB
- `routes/admin.js` - Administration API (list accounts, lock and unlock accounts)
- `models/Thread.js` - MongoDB thread schema with embedded reply documents
- `models/Category.js` - MongoDB forum category schema
- `seed-forum.js` - Seeds forum categories and demo threads without touching other collections

### Nguyen Khanh Nguyen (S4197203) - Blog + User Account
Blog module:
- `views/blog.ejs` - Blog list with client-side search, sort, and tag filtering (Web Storage preferences)
- `views/detailblog.ejs` - Full post view with comments and owner edit/delete
- `views/writeblog.ejs` - Create / edit post form with live validation and draft autosave
- `routes/blogs.js` - Blog routes (pages + JSON API) with server-side validation and ownership checks
- `models/Blog.js` - MongoDB blog schema with embedded comment documents
- `data/blogs.json` - Blog seed data

Shared User Account module (with team):
- `Login.html` + `public/js/auth.js` - Login, sign up, forgot password, and reset password forms (live validation)
- `Profile.html` + `public/js/profile.js` - Edit profile, change email/password, delete account
- `server.js` - Auth API endpoints with server-side validation and in-memory fallback
- `models/User.js` - MongoDB user schema
- `models/memoryUsers.js` - In-memory user store used as a fallback if MongoDB is unreachable
- `middleware/currentUser.js` - Identifies the current user for API requests
- `middleware/resolveUser.js` - Resolves the logged-in session user for ownership checks
- `public/js/current-user.js`, `public/js/header.js` - Logged-in state and admin-only UI across pages

### Shared / Assets
- `logo.png` - Playnex logo
- `uploads/` - User-uploaded profile pictures
- `public/img/` - Product and article images
- `server.js` - Express server, shared modules, and module routes

## Live Website
https://playnex-m13w.onrender.com

## GitHub Repository
https://github.com/s4113887rmit/Playnex

## How to Run and Test

1. Install dependencies (only once):
   ```
   npm install
   ```
2. Create a `.env` file with your MongoDB Atlas connection string:
   ```
   MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/playnex?retryWrites=true&w=majority
   PORT=3000
   SESSION_SECRET=any-long-random-string
   ```
   `SESSION_SECRET` is optional. Without it the server generates a random one at
   startup and logs a warning, which also means logins do not survive a restart.
3. Seed the database (first time only). This clears and rebuilds blogs, games,
   products, forum categories and forum threads:
   ```
   node seed.js
   ```
4. Refresh just the forum categories and demo threads on a database that already
   has content. This does not modify any other collection and is safe to run
   repeatedly, which makes it the right command to use on the live database:
   ```
   node seed-forum.js
   ```
5. Start the server:
   ```
   npm start
   ```
6. Open http://localhost:3000

### MongoDB Connection
- **Database**: MongoDB Atlas (cloud-hosted)
- **Cluster**: playnex.mzcuobd.mongodb.net
- **Database name**: playnex
- **Collections**: blogs, games, products, carts, wishlists, orders, users, threads, categories

### Demo accounts

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@playnex.com | admin12345 |
| User | john@example.com | password123 |

### Testing the User Account module (shared)
- Log in and sign up from `Login.html`; all forms validate live and show server errors
- Forgot password prints a reset code to the server console; complete the reset with the "I already have a reset code" form
- On `Profile.html`, edit your profile, change email/password, and deactivate the account (confirmation required)
- The header shows a profile icon and Log out button only when logged in; the Admin Panel button appears only for the admin account

### Testing the Blog module
- Browse `/blog`; search, sort, and tag filtering run entirely in the browser and survive a page refresh
- Click `Write a post` (visible when logged in) or open `/blog/new`
- The write form validates live, counts characters, and autosaves a draft in localStorage (restored after refresh)
- Logged-in users can edit and delete only their own posts; the admin can delete any comment
- JSON API: `GET /api/blogs`, `GET /api/blogs/:id`, `POST /api/blogs`, `PUT /api/blogs/:id`, `DELETE /api/blogs/:id`, `POST /api/blogs/:id/comments`

### Testing the Game Rating module
- Open `/rating` to browse games with client-side search and sorting
- Open a game at `/game/:id` to see the average rating, rating distribution, and user reviews
- Write, edit, and delete reviews from `/game/:id/review`; only the review owner or an admin can edit/delete

### Testing the Store modules
- Browse `shopping.html` with filters, sorting, and search; open a game detail page from any card
- Add items to the cart and wishlist, update quantities, move wishlist items to the cart
- Complete the checkout form (invalid data is rejected with field errors) and view the confirmation page
- Wishlist items show live statistics (how many wishlists contain the item, cart adds and purchases)

### Testing the Forum and Admin modules
- **Forum Threads:** open `forum.html` to view the thread list, which is loaded from the `threads` collection in MongoDB
- **Search, filter and sort:** use the search box, the category filter and the sort dropdown (latest, oldest, most viewed, most replies, and so on)
- **Single Thread:** click any thread title to load it on `forum-detail.html` with its replies; the view counter is stored in the database
- **Create, Edit, Delete:** logged-in users create threads, reply, and edit or delete their own threads and replies. Deleted content is hidden from the site but retained in the database for auditing
- **Admin Dashboard:** log in with the Admin demo account and open `admin.html`. The list shows the real registered accounts from the `users` collection
- **Lock and Unlock:** locking an account sets `isLocked` on that user in MongoDB. A locked user can no longer log in and is refused by the API. Administrator accounts cannot be locked
- JSON API: `GET /api/threads`, `GET /api/threads/:id`, `POST /api/threads`, `PUT /api/threads/:id`, `DELETE /api/threads/:id`, `POST /api/threads/:id/replies`, and `GET /api/users`, `GET /api/users/:id`, `POST /api/users/:id/toggle-lock`

## Technical Stack

| Layer | Technology |
|-------|-----------|
| Front-end | HTML, CSS, JavaScript (no external frameworks) |
| Back-end | NodeJS, Express, EJS |
| Database | MongoDB Atlas (cloud-hosted) |
| Data | MongoDB Atlas with Mongoose for all application data; JSON files are used only by the seed scripts |

## Assignment Notes
- No external frameworks (React, jQuery, Bootstrap, etc.) are used per course requirement
- All submitted code is original work
- Database seeded with sample data via `node seed.js`, and forum data via `node seed-forum.js`
