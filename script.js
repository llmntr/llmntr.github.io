const DEFAULT_INTERVAL = 4;
const SWIPE_DISTANCE = 30;
const LABELS = {
  cs: { previous: "Předchozí", next: "Další", portrait: "Portrét – Adam Koranda" },
  en: { previous: "Previous", next: "Next", portrait: "Portrait – Adam Koranda" },
};

let language = document.documentElement.lang;
const lightbox = document.querySelector(".lightbox");
const lightboxThumb = lightbox.querySelector(".thumb");
const carousels = [];
let lightboxCarousel = null;
let swipeStart = null;

function createArrow(className, text, label, onClick) {
  const arrow = document.createElement("button");
  arrow.type = "button";
  arrow.className = `arrow ${className}`;
  arrow.textContent = text;
  arrow.setAttribute("aria-label", label);
  arrow.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    onClick();
  });
  return arrow;
}

function createCarousel(box, seconds, startIndex = 0) {
  const items = [...box.querySelectorAll("img, video")];
  let index = startIndex;
  let running = false;
  let timer = null;

  function playCurrent() {
    const item = items[index];
    if (item.tagName === "VIDEO") {
      item.muted = true;
      item.play().catch(() => {});
    }
  }

  function pauseCurrent() {
    const item = items[index];
    if (item.tagName === "VIDEO") {
      item.pause();
    }
  }

  function restartTimer() {
    clearInterval(timer);
    if (running && seconds && items.length > 1) {
      timer = setInterval(() => show(index + 1), seconds * 1000);
    }
  }

  function show(next) {
    pauseCurrent();
    items[index].classList.remove("is-active");
    index = (next + items.length) % items.length;
    items[index].classList.add("is-active");
    if (items[index].tagName === "VIDEO") {
      items[index].currentTime = 0;
    }
    if (running) {
      playCurrent();
    }
  }

  function step(direction) {
    if (items.length < 2) {
      return;
    }
    show(index + direction);
    restartTimer();
  }

  items[index].classList.add("is-active");
  if (items.length > 1) {
    box.append(
      createArrow("arrow-previous", "<", LABELS[language].previous, () => step(-1)),
      createArrow("arrow-next", ">", LABELS[language].next, () => step(1)),
    );
  }

  return {
    visible: false,
    get index() {
      return index;
    },
    show,
    step,
    start() {
      running = true;
      playCurrent();
      restartTimer();
    },
    stop() {
      running = false;
      clearInterval(timer);
      pauseCurrent();
    },
  };
}

// Šipka je na prst moc úzká, proto na dotyku přepíná celá levá a pravá třetina náhledu.
function touchDirection(event, thumb) {
  if (!window.matchMedia("(any-hover: none)").matches || !thumb.querySelector(".arrow")) {
    return 0;
  }
  const box = thumb.getBoundingClientRect();
  const position = (event.clientX - box.left) / box.width;
  if (position < 1 / 3) {
    return -1;
  }
  return position > 2 / 3 ? 1 : 0;
}

function openLightbox(thumb, carousel) {
  carousels.forEach((item) => item.stop());
  const copies = [...thumb.querySelectorAll("img, video")].map((item) => {
    const copy = item.cloneNode();
    copy.classList.remove("is-active");
    return copy;
  });
  lightboxThumb.replaceChildren(...copies);
  lightboxCarousel = createCarousel(lightboxThumb, null, carousel.index);
  lightboxCarousel.source = carousel;
  lightbox.showModal();
  lightboxThumb.focus();
  lightboxCarousel.start();
}

const visibility = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    const carousel = carousels[Number(entry.target.dataset.carousel)];
    carousel.visible = entry.isIntersecting;
    if (!entry.isIntersecting) {
      carousel.stop();
    } else if (!lightbox.open) {
      carousel.start();
    }
  });
});

document.querySelectorAll(".project").forEach((project) => {
  const thumb = project.querySelector(".thumb");
  const seconds = Number(project.dataset.interval) || DEFAULT_INTERVAL;
  const carousel = createCarousel(thumb, seconds);
  thumb.dataset.carousel = carousels.push(carousel) - 1;

  if (!thumb.matches("a")) {
    thumb.setAttribute("role", "button");
    thumb.tabIndex = 0;
    thumb.addEventListener("click", (event) => {
      const direction = touchDirection(event, thumb);
      if (direction) {
        carousel.step(direction);
      } else {
        openLightbox(thumb, carousel);
      }
    });
    thumb.addEventListener("keydown", (event) => {
      if (event.target === thumb && (event.key === "Enter" || event.key === " ")) {
        event.preventDefault();
        openLightbox(thumb, carousel);
      }
    });
  }

  visibility.observe(thumb);
});

function applyLanguage() {
  const labels = LABELS[language];
  document.documentElement.lang = language;
  document.querySelector(".portrait").alt = labels.portrait;
  document.querySelectorAll(".arrow-previous").forEach((arrow) => arrow.setAttribute("aria-label", labels.previous));
  document.querySelectorAll(".arrow-next").forEach((arrow) => arrow.setAttribute("aria-label", labels.next));
  document.querySelectorAll(".project").forEach((project) => {
    const title = project.querySelector(`p[lang="${language}"] strong`).textContent;
    project.querySelector(".thumb").setAttribute("aria-label", title);
  });
  document.querySelectorAll(".languages button").forEach((button) => {
    button.setAttribute("aria-pressed", button.dataset.language === language);
  });
}

document.querySelectorAll(".languages button").forEach((button) => {
  button.addEventListener("click", () => {
    language = button.dataset.language;
    try {
      localStorage.setItem("language", language);
    } catch {}
    applyLanguage();
  });
});

applyLanguage();

lightbox.addEventListener("click", (event) => {
  if (event.target === lightbox) {
    lightbox.close();
  }
});

lightbox.addEventListener("keydown", (event) => {
  if (event.key === "ArrowLeft") {
    lightboxCarousel.step(-1);
  } else if (event.key === "ArrowRight") {
    lightboxCarousel.step(1);
  }
});

lightboxThumb.addEventListener("touchstart", (event) => {
  const touch = event.touches[0];
  swipeStart = event.touches.length === 1 ? { x: touch.clientX, y: touch.clientY } : null;
}, { passive: true });

lightboxThumb.addEventListener("touchend", (event) => {
  if (!swipeStart) {
    return;
  }
  const touch = event.changedTouches[0];
  const distanceX = touch.clientX - swipeStart.x;
  const distanceY = touch.clientY - swipeStart.y;
  swipeStart = null;
  if (Math.abs(distanceX) >= SWIPE_DISTANCE && Math.abs(distanceX) > Math.abs(distanceY)) {
    lightboxCarousel.step(distanceX < 0 ? 1 : -1);
  }
});

lightbox.addEventListener("close", () => {
  lightboxCarousel.stop();
  lightboxCarousel.source.show(lightboxCarousel.index);
  lightboxThumb.replaceChildren();
  carousels.filter((item) => item.visible).forEach((item) => item.start());
});
