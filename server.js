const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const DATA_PATH = path.join(__dirname, "data", "games.json");

app.set("view engine", "ejs");
app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));


function readGames() {
  const games = JSON.parse(fs.readFileSync(DATA_PATH, "utf-8"));
  let changed = false;
  games.forEach((g) => {
    g.reviews.forEach((r) => {
      if (!r.id) {
        r.id = "r_" + Date.now() + Math.random().toString(36).slice(2, 8);
        changed = true;
      }
    });
  });
  if (changed) writeGames(games);
  return games;
}

function writeGames(games) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(games, null, 2));
}

// Calculate avarage rating//
function getAvgRating(game) {
  const totalCount = game.baseCount + game.reviews.length;
  const totalScore =
    game.baseRating * game.baseCount +
    game.reviews.reduce((sum, r) => sum + r.stars, 0);
  const avg = totalCount ? totalScore / totalCount : 0;
  return { avg, count: totalCount };
}

// Calculate the percentage of game rating//
function getDistribution(game) {
  const dist = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  dist[game.baseRating] += game.baseCount;
  game.reviews.forEach((r) => (dist[r.stars] += 1));
  const total = Object.values(dist).reduce((a, b) => a + b, 0) || 1;
  const percent = {};
  for (const star in dist) {
    percent[star] = Math.round((dist[star] / total) * 100);
  }
  return percent;
}
function validateReviewInput(title, content, rating) {
  const errors = [];
  const t = (title || "").trim();
  const c = (content || "").trim();
  const r = parseInt(rating);

  if (!t) errors.push("Cant leave blank");
  if (t.length > 80) errors.push("Title maximum 80   characters");
  if (c.length < 10) errors.push("The content must be at least 10 characters long.");
  if (c.length > 2000) errors.push("The content must be no more than 2,000 characters long.");
  if (!Number.isInteger(r) || r < 1 || r > 5) errors.push("The rating must be between 1 and 5.");

  return errors;
}

// RATING
app.get("/rating", (req, res) => {
  let games = readGames();
  games = games.map((g) => ({ ...g, ...getAvgRating(g) }));

  const filterStar = req.query.stars ? parseInt(req.query.stars) : null;
  const q = (req.query.search || "").toLowerCase();

  let filtered = games;
  if (filterStar) {
    filtered = filtered.filter((g) => Math.round(g.avg) === filterStar);
  }
  if (q) {
    filtered = filtered.filter((g) => g.name.toLowerCase().includes(q));
  }

  res.render("rating", { games: filtered, filterStar, search: req.query.search || "" });
});

app.get("/api/games", (req, res) => {
  let games = readGames().map((g) => ({ ...g, ...getAvgRating(g) }));
  const q = (req.query.search || "").toLowerCase();
  if (q) games = games.filter((g) => g.name.toLowerCase().includes(q));
  res.json(games.map(({ id, name, image, avg }) => ({ id, name, image, avg })));
});

// RATINGGAME
app.get("/game/:id", (req, res) => {
  const games = readGames();
  const game = games.find((g) => g.id === parseInt(req.params.id));
  if (!game) return res.status(404).send("Game not found");

  const { avg, count } = getAvgRating(game);
  const distribution = getDistribution(game);

  res.render("ratinggame", { game, avg, count, distribution });
});

// Write game review

app.get("/game/:id/review", (req, res) => {
  const games = readGames();
  const game = games.find((g) => g.id === parseInt(req.params.id));
  if (!game) return res.status(404).send("Game not found");

  let review = null;
  if (req.query.edit) {
    review = game.reviews.find((r) => r.id === req.query.edit) || null;
    // nếu sau này có login: chặn sửa review không phải của mình
    // if (review && review.userId !== req.session.user?.id) return res.status(403).send("Không có quyền");
  }

  res.render("writegamereview", { game, review, errors: [] });
});

// Submit review mới HOẶC cập nhật review cũ (form gửi hidden field reviewId)
app.post("/game/:id/review", (req, res) => {
  const games = readGames();
  const game = games.find((g) => g.id === parseInt(req.params.id));
  if (!game) return res.status(404).send("Game not found");

  const { title, content, rating, image, reviewId } = req.body;
  const errors = validateReviewInput(title, content, rating);

  if (errors.length) {
    const review = reviewId ? game.reviews.find((r) => r.id === reviewId) : null;
    return res.status(400).render("writegamereview", { game, review, errors });
  }

  if (reviewId) {
    // cập nhật review đã tồn tại
    const review = game.reviews.find((r) => r.id === reviewId);
    if (!review) return res.status(404).send("Review not found");
    review.title = title.trim();
    review.content = content.trim();
    review.stars = parseInt(rating);
    review.image = (image || "").trim();
    review.date = new Date().toLocaleDateString("vi-VN") + " (edited)";
  } else {
    // tạo review mới
    game.reviews.push({
      id: "r_" + Date.now(),
      author: "You", // TODO: thay bằng req.session.user.username khi có login
      date: new Date().toLocaleDateString("vi-VN"),
      stars: parseInt(rating),
      title: title.trim(),
      content: content.trim(),
      image: (image || "").trim(),
    });
  }

  writeGames(games);
  res.redirect("/game/" + game.id);
});

// Xoá review
app.post("/game/:id/review/:reviewId/delete", (req, res) => {
  const games = readGames();
  const game = games.find((g) => g.id === parseInt(req.params.id));
  if (!game) return res.status(404).send("Game not found");

  const exists = game.reviews.some((r) => r.id === req.params.reviewId);
  if (!exists) return res.status(404).send("Review not found");

  // nếu sau này có login: kiểm tra review.userId === req.session.user.id trước khi xoá

  game.reviews = game.reviews.filter((r) => r.id !== req.params.reviewId);
  writeGames(games);
  res.redirect("/game/" + game.id);
});

app.listen(3000, () => console.log("Server at: http://localhost:3000"));