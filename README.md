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
- `views/rating.ejs` - Browse games with search, rating filters, and average star ratings
- `views/ratinggame.ejs` - Game review details with rating breakdown and user reviews
- `views/writegamereview.ejs` - Submit a star rating and written review for a game
- `data/games.json` - Game and review data
- `sitemap.html` - Website sitemap showing page navigation and module structure

### Nguyen Ngoc Quang Dang (S4113887)
- `homepage.html` - Landing page with hero, new releases, merch shelves
- `shopping.html` - Product catalog with filters, sorting, pagination
- `cart.html` - Shopping cart with quantity controls and order summary
- `checkout.html` - Delivery and payment form
- `confirmation.html` - Order confirmation page
- `wishlist.html` - Saved items with purchased/favorited sections
- `routes/products.js`, `routes/cart.js`, `routes/wishlist.js`, `routes/checkout.js` - Store APIs
- `public/js/shopping.js`, `cart.js`, `wishlist.js`, `checkout.js`, `confirmation.js`, `homepage.js` - Client scripts
- `style.css` - Global stylesheet (shared)

### Tran Binh An (S4206755)
- `forum.html` - Main thread list and category filters
- `forum-detail.html` - Detailed view of a single thread and replies
- `forum-create.html` - Form to create or edit a discussion post
- `admin.html` - Administrator dashboard for managing locked/normal accounts
- `admin-detail.html` - Detailed user moderation view with flags and purchase history

### Nguyen Khanh Nguyen (S4197203) - Blog + User Account
Blog module:
- `views/blog.ejs` - Blog list with client-side search, sort, and tag filtering (Web Storage prefs)
- `views/detailblog.ejs` - Full post view with comments and owner edit/delete
- `views/writeblog.ejs` - Create / edit post form with live validation and draft autosave
- `routes/blogs.js` - Blog routes (pages + JSON API) with server-side validation and ownership checks
- `data/blogs.json` - Blog post data

Shared User Account module (with team):
- `Login.html` + `public/js/auth.js` - Login, sign up, forgot password (live validation)
- `Profile.html` + `public/js/profile.js` - Edit profile, change email/password, delete account
- `server.js` - Auth API endpoints with server-side validation and in-memory fallback
- `models/User.js` - MongoDB user schema
- `models/memoryUsers.js` - In-memory user store for the A2 prototype
- `middleware/currentUser.js` - Identifies the current user for API requests
- `public/js/current-user.js`, `public/js/header.js` - Logged-in state across pages

### Shared / Assets
- `logo.png` - Playnex logo
- `uploads/` - User-uploaded profile pictures
- `public/img/` - Product and article images

## How to Run and Test

1. Install dependencies (only once):
   ```
   npm install
   ```
2. Start the server:
   ```
   npm start
   ```
   (or run `start.bat`)
3. Open http://localhost:3000

### Demo accounts

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@playnex.com | admin12345 |
| User | john@example.com | password123 |

The A2 prototype does not require MongoDB. If the MongoDB Atlas connection is unavailable, the app automatically falls back to in-memory users and the demo accounts above.

### Testing the Blog module
- Browse `/blog`; search, sort, and tag-filter run entirely in the browser
- Click `Write a post` (visible when logged in), or go to `/blog/new`
- The write form validates live, counts characters, and autosaves a draft in localStorage (restored after a page refresh)
- Logged-in users can edit and delete only their own posts; comment forms validate before posting
- JSON API: `GET /api/blogs`, `GET /api/blogs/:id`, `POST /api/blogs`, `PUT /api/blogs/:id`, `DELETE /api/blogs/:id`, `POST /api/blogs/:id/comments`

## Technical Stack

| Layer | Technology |
|-------|-----------|
| Front-end | HTML, CSS, JavaScript (no external frameworks) |
| Back-end | NodeJS, Express, EJS |
| Data | In-memory / JSON files (A2), MongoDB Atlas + Mongoose (A3) |

## Assignment Notes
- No external frameworks (React, jQuery, Bootstrap, etc.) are used per course requirement
- All submitted code is original work
