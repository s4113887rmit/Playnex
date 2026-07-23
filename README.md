# Playnex - Group Project

Playnex is a digital games and physical merchandise storefront. Browse games, add items to your cart or wishlist, participate in community discussions, and manage your profile.

## Team Members and Responsibilities

| Member | Role | Modules |
|--------|------|---------|
| **Dang** (Lead) | Shopping Cart & Product Reviews | Shopping cart, checkout, confirmation, product catalog, reviews, homepage |
| **An** | Discussion Forum & Administration | Forum threads/posts, admin panel, user management |
| **Nguyen** | User Account Management | Registration, login, profile editing, password reset, account deletion |
| **Bao** | Community Hub, Wishlist & Blog | Wishlist, blog posts, community features |

## File and Folder Distribution

### Dang
- `homepage.html` - Landing page with hero, new releases, merch shelves
- `Shopping.html` - Product catalog with filters, sorting, pagination
- `Cart.html` - Shopping cart with quantity controls and order summary
- `Checkout.html` - Delivery and payment form
- `Confirmation.html` - Order confirmation page
- `reviews/` - Product review and rating system (to be added)

### An
- `forum/` - Discussion forum threads and posts (to be added)
- `admin/` - Administration panel for site management (to be added)

### Nguyen
- `Login.html` - Login, sign up, and forgot password forms
- `Profile.html` - Profile settings with edit profile, achievements, email/password change, account deletion
- `models/User.js` - MongoDB user schema with authentication fields
- `server.js` - Express server with auth routes (signup, login, profile, password reset)
- `public/js/auth.js` - Client-side auth form validation and API calls
- `public/js/profile.js` - Client-side profile management
- `public/js/header.js` - Dynamic header (shows profile icon after login)
- `.gitignore` - Git ignore rules

### Bao
- `Wishlist.html` - Saved items with purchased/favorited sections
- `blog/` - Blog platform (to be added)

### Shared / Assets
- `Style.css` - Global stylesheet with design system (CSS custom properties, BEM naming)
- `logo.png` - Playnex logo
- `uploads/` - User-uploaded profile pictures
- `package.json` - Node.js dependencies
- `start.bat` - One-click server launcher
- `sitemap.html` - Auto-generated site map (to be added)

## Technical Stack

| Layer | Technology |
|-------|-----------|
| Front-end | HTML5, CSS3, JavaScript (Vanilla) |
| Back-end | Node.js, Express |
| Database | MongoDB Atlas (Mongoose ODM) |
| File Upload | Multer |
| Security | bcryptjs password hashing, express-rate-limit |

## How to Run

1. Install [Node.js](https://nodejs.org/)
2. Install dependencies:
   ```
   npm install
   ```
3. Update the MongoDB URI in `server.js` line 19 with your Atlas connection string
4. Start the server:
   - Double-click `start.bat` or run `node server.js`
5. Open `http://localhost:3000` in your browser

## Assignment Notes

- No external frameworks (React, jQuery, etc.) are used per course requirements
- All backend data is stored in MongoDB Atlas
- Images and static files are stored locally; their URLs are referenced in the database
- All submitted code is original work
