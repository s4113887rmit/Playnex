# Playnex - Group Project

Playnex is a digital games and physical merchandise storefront. Browse games, add items to your cart or wishlist, participate in community discussions, and manage your profile.

## Team Members

| Full Name | Student ID | Module |
|-----------|-----------|--------|
| Ngo Gia Bao | S4186655 | Game Rating, Site Map |
| Nguyen Ngoc Quang Dang | S4113887 | Shopping Cart, Homepage, Wishlist, Checkout, Confirmation |
| Tran Binh An | S4206755 | Discussion Forums, Administration Page |
| Nguyen Khanh Nguyen | S4197203 | Blogs, User Account |

## File and Folder Distribution

### Ngo Gia Bao (S4186655)
- Game rating and review pages
- Site map page

### Nguyen Ngoc Quang Dang (S4113887)
- `homepage.html` - Landing page with hero, new releases, merch shelves
- `Shopping.html` - Product catalog with filters, sorting, pagination
- `Cart.html` - Shopping cart with quantity controls and order summary
- `Checkout.html` - Delivery and payment form
- `Confirmation.html` - Order confirmation page
- `Wishlist.html` - Saved items with purchased/favorited sections
- `Style.css` - Global stylesheet (shared)

### Tran Binh An (S4206755)
- `forum.html` - Main thread list and category filters
- `forum-detail.html` - Detailed view of a single thread and replies
- `forum-create.html` - Form to create or edit a discussion post
- `admin.html` - Administrator dashboard for managing locked/normal accounts
- `admin-detail.html` - Detailed user moderation view with flags and purchase history

### Nguyen Khanh Nguyen (S4197203)
- `Login.html` - Login, sign up, and forgot password forms
- `Profile.html` - Profile settings with edit profile, achievements, email/password change, account deletion
- `blog/` - Blog platform (to be added)
- `models/User.js` - MongoDB user schema with authentication fields
- `server.js` - Express server with auth routes (signup, login, profile, password reset, account management)
- `public/js/auth.js` - Client-side auth form validation and API calls
- `public/js/profile.js` - Client-side profile management
- `public/js/header.js` - Dynamic header (shows profile icon after login)

### Shared / Assets
- `logo.png` - Playnex logo
- `uploads/` - User-uploaded profile pictures
- `package.json` - Node.js dependencies
- `start.bat` - One-click server launcher

## Technical Stack

| Layer | Technology |
|-------|-----------|
| Front-end | HTML5, CSS3, JavaScript (Vanilla) |
| Back-end | Node.js, Express |
| Database | MongoDB Atlas (Mongoose ODM) |
| File Upload | Built-in Node.js `fs` module + browser FileReader API (base64) |
| Security | bcryptjs password hashing, express-rate-limit |

## How to Run

1. Install [Node.js](https://nodejs.org/)
2. Install dependencies:
   ```
   npm install
   ```
3. Create a `.env` file from the template:
   ```
   cp .env.example .env
   ```
   Then edit `.env` and add your MongoDB Atlas connection string.
4. Start the server:
   - Double-click `start.bat` or run `node server.js`
5. Open `http://localhost:3000` in your browser

## Assignment Notes

- No external frameworks (React, jQuery, Bootstrap, etc.) are used per course requirements
- No external file upload libraries (multer replaced with built-in fs + base64)
- All backend data is stored in MongoDB Atlas
- Images and static files are stored locally; their URLs are referenced in the database
- All submitted code is original work
