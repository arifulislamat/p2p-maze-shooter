// ===========================================
// Physics — Collision Detection
// ===========================================

const Physics = (() => {
  // ---- AABB Collision (two rectangles) ----
  function rectsOverlap(a, b) {
    return (
      a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
    );
  }

  // ---- Circle-Rect Collision (bullet vs player/obstacle) ----
  function circleRectOverlap(circle, rect) {
    // Find closest point on rect to circle center
    const closestX = Math.max(rect.x, Math.min(circle.x, rect.x + rect.w));
    const closestY = Math.max(rect.y, Math.min(circle.y, rect.y + rect.h));

    const dx = circle.x - closestX;
    const dy = circle.y - closestY;

    return dx * dx + dy * dy < circle.r * circle.r;
  }

  // ---- Check if player can move to new position ----
  function canMoveTo(newX, newY) {
    const playerRect = { x: newX, y: newY, w: PLAYER_SIZE, h: PLAYER_SIZE };

    // Arena bounds
    if (
      newX < 0 ||
      newX + PLAYER_SIZE > CANVAS_WIDTH ||
      newY < 0 ||
      newY + PLAYER_SIZE > CANVAS_HEIGHT
    ) {
      return false;
    }

    // Wall collision (uses active maze)
    for (const wall of activeMaze.walls) {
      if (rectsOverlap(playerRect, wall)) {
        return false;
      }
    }

    return true;
  }

  // ---- Check bullet vs walls → returns true if bullet should be removed ----
  function bulletHitsObstacle(bullet) {
    const bRect = {
      x: bullet.x - BULLET_WIDTH / 2,
      y: bullet.y - BULLET_HEIGHT / 2,
      w: BULLET_WIDTH,
      h: BULLET_HEIGHT,
    };

    for (const wall of activeMaze.walls) {
      if (rectsOverlap(bRect, wall)) {
        return true;
      }
    }
    return false;
  }

  // ---- Check bullet vs player → returns true if hit ----
  function bulletHitsPlayer(bullet, player) {
    if (!player.alive) return false;

    const bRect = {
      x: bullet.x - BULLET_WIDTH / 2,
      y: bullet.y - BULLET_HEIGHT / 2,
      w: BULLET_WIDTH,
      h: BULLET_HEIGHT,
    };
    const pRect = { x: player.x, y: player.y, w: PLAYER_SIZE, h: PLAYER_SIZE };

    return rectsOverlap(bRect, pRect);
  }

  // ---- Check if bullet is out of bounds ----
  function bulletOutOfBounds(bullet) {
    return (
      bullet.x < -BULLET_SIZE ||
      bullet.x > CANVAS_WIDTH + BULLET_SIZE ||
      bullet.y < -BULLET_SIZE ||
      bullet.y > CANVAS_HEIGHT + BULLET_SIZE
    );
  }

  return {
    rectsOverlap,
    circleRectOverlap,
    canMoveTo,
    bulletHitsObstacle,
    bulletHitsPlayer,
    bulletOutOfBounds,
  };
})();
