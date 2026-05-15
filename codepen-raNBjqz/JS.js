document.addEventListener("DOMContentLoaded", () => {
  gsap.registerPlugin(Flip);

  // Cache DOM elements
  const scrollWrapper = document.querySelector('[data-scroll="wrapper"]');

  // Initialize smooth scrolling
  const lenis = new Lenis({
    autoRaf: true,
    wrapper: scrollWrapper,
    content: document.querySelector('[data-scroll="content"]'),
    orientation: "horizontal",
    lerp: 0.05,
    wheelMultiplier: 0.85,
    smoothWheel: true,
    smoothTouch: true,
    touchMutliplier: 2,
  });

  const galleryImagesWrapper = document.querySelectorAll(
    '[data-gallery="image-wrapper"]',
  );
  const galleryImages = document.querySelectorAll('[data-gallery="image"]');

  const sectionContent = document.querySelector('[data-content="section"]');
  const contents = document.querySelectorAll('[data-content="details"]');
  const contentWrappers = document.querySelectorAll(
    '[data-content="details-wrapper"]',
  );
  const contentWrapperImages = document.querySelectorAll(
    '[data-content="details-wrapper"] .image_container',
  );

  const cursor = document.querySelector('[data-cursor="container"]');

  // State management
  let listOfSplits = [];
  let currentOpenIndex = null;
  let isAnimating = false;
  let currentAnimation = null;
  let rafId = null;
  let cursorX = 0;
  let cursorY = 0;
  let targetX = 0;
  let targetY = 0;

  // Initialize content
  scrollWrapper.classList.remove("is-hidden");

  contents.forEach((content, index) => {
    content.classList.add("is-hidden");
    listOfSplits[index] = initializeSplitText(content);
  });
  contentWrapperImages.forEach((image) => image.remove());

  // Improved cursor movement with RAF
  function updateCursor() {
    cursorX += (targetX - cursorX) * 0.15;
    cursorY += (targetY - cursorY) * 0.15;
    cursor.style.transform = `translate3d(${cursorX}px, ${cursorY}px, 0)`;
    rafId = requestAnimationFrame(updateCursor);
  }

  function handleMouseMove(e) {
    const cursorBounds = cursor.getBoundingClientRect();
    targetX = e.clientX - (cursorBounds.width * 3) / 4;
    targetY = e.clientY - (cursorBounds.height * 3) / 4;
    if (!rafId) {
      rafId = requestAnimationFrame(updateCursor);
    }
  }

  // Touch support
  function handleTouchStart(e, index) {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      handleImageClick(index);
    }
  }

  function handleImageClick(index) {
    if (currentOpenIndex === null) {
      openContent(index);
    }
  }

  function handleWrapperClick(index) {
    if (currentOpenIndex === index) {
      hideContent(index);
    }
  }

  function initializeSplitText(content) {
    if (!content) return null;

    const contentTitleTop = content.querySelectorAll(
      '[data-content="text-top"] div',
    );
    const contentTitleBottom = content.querySelectorAll(
      '[data-content="text-bottom"] div',
    );
    const contentTextLeft = content.querySelectorAll(
      '[data-content="text-left"] div',
    );
    const contentTextRight = content.querySelectorAll(
      '[data-content="text-right"] div',
    );

    const titleTopSplits = Array.from(
      contentTitleTop,
      (n) => new SplitType(n, { types: "chars" }),
    );

    const titleBottomSplits = Array.from(
      contentTitleBottom,
      (n) => new SplitType(n, { types: "chars" }),
    );

    titleTopSplits[0]?.chars?.forEach((char) => {
      const wrapper = document.createElement("div");
      wrapper.classList.add("char-wrap");
      char.parentNode.insertBefore(wrapper, char);
      wrapper.appendChild(char);
    });

    const textLeftSplits = Array.from(
      contentTextLeft,
      (n) => new SplitType(n, { types: "lines" }),
    );

    const textRightSplits = Array.from(
      contentTextRight,
      (n) => new SplitType(n, { types: "lines" }),
    );

    [textLeftSplits, textRightSplits].forEach((splits) => {
      splits.forEach((split) => {
        split.lines?.forEach((line) => {
          const wrapper = document.createElement("div");
          wrapper.classList.add("line-wrap");
          line.parentNode.insertBefore(wrapper, line);
          wrapper.appendChild(line);
        });
      });
    });

    return {
      titleTopSplits,
      titleBottomSplits,
      textLeftSplits,
      textRightSplits,
    };
  }

  // Optimized open animation with will-change
  const openContent = (index) => {
    if (isAnimating) return;

    isAnimating = true;
    isOpening = true;
    contents[index].classList.remove("is-hidden");
    const currentWrapper = contentWrappers[index];
    const splits = listOfSplits[index];

    // Add will-change to optimize animations
    splits.titleTopSplits[0].chars.forEach((char) => {
      char.style.willChange = "transform, clip-path";
    });

    currentAnimation = gsap.timeline({
      duration: 1.25,
      ease: "power4.inOut",
      onStart: () => {
        sectionContent.classList.remove("is-hidden");
      },
      onComplete: () => {
        isAnimating = false;
        currentOpenIndex = index;
        lenis.stop();
        scrollWrapper.classList.add("is-hidden");
        cursor.classList.add("is-open");
        currentAnimation = null;
        isOpening = false;
        // Clean up will-change
        splits.titleTopSplits[0].chars.forEach((char) => {
          char.style.willChange = "auto";
        });
      },
    });

    currentAnimation
      .addLabel("start", 0)
      .addLabel("texts", 0.5)
      .add(() => {
        const flipState = Flip.getState(galleryImages[index]);
        currentWrapper.appendChild(galleryImages[index]);

        Flip.from(flipState, {
          duration: 1.25,
          ease: "power4.inOut",
        });
      }, "start")
      .to(
        gsap.utils
          .toArray(galleryImagesWrapper)
          .filter((img, i) => i !== index),
        {
          clipPath: "inset(100% 0 0 0)",
          duration: 0.75,
          ease: "power3.inOut",
        },
        0,
      )
      .fromTo(
        [splits.titleTopSplits[0].elements, splits.titleTopSplits[0].elements],
        {
          xPercent: 15,
        },
        {
          xPercent: 0,
          duration: 1,
          ease: "power3.out",
        },
        "start+=1.25",
      )
      .fromTo(
        [splits.titleTopSplits[0].chars, splits.titleBottomSplits[0].chars],
        {
          clipPath: "inset(0 100% 0 0)",
          xPercent: 10,
        },
        {
          clipPath: "inset(0 0% 0 0)",
          xPercent: 0,
          duration: 0.75,
          ease: "power3.out",
        },
        "start+=1.25",
      )
      .fromTo(
        [
          ...splits.textLeftSplits.flatMap((split) => split.lines),
          ...splits.textRightSplits.flatMap((split) => split.lines),
        ],
        {
          yPercent: 100,
          opacity: 0,
        },
        {
          yPercent: 0,
          opacity: 1,
          stagger: 0.025,
        },
        "start+=1.2",
      );
  };

  // Rest of your original hideContent function remains the same
  const hideContent = (index) => {
    if (isAnimating || currentOpenIndex === null) return;

    isAnimating = true;
    const currentWrapper = contentWrappers[index];
    const splits = listOfSplits[index];
    lenis.start();
    scrollWrapper.classList.remove("is-hidden");

    currentAnimation = gsap.timeline({
      duration: 1.25,
      ease: "power4.inOut",
      onComplete: () => {
        isAnimating = false;
        currentOpenIndex = null;
        currentAnimation = null;
        cursor.classList.remove("is-open");
        sectionContent.classList.add("is-hidden");
        contents[index].classList.add("is-hidden");
      },
    });

    currentAnimation
      .addLabel("start", 0)
      .fromTo(
        [
          splits.titleTopSplits[0].elements,
          splits.titleBottomSplits[0].elements,
        ],
        {
          xPercent: 0,
        },
        {
          xPercent: 10,
          ease: "power3.out",
          duration: 1,
        },
        "start",
      )
      .fromTo(
        [splits.titleTopSplits[0].chars, splits.titleBottomSplits[0].chars],
        {
          clipPath: "inset(0 0% 0 0)",
          xPercent: 0,
        },
        {
          clipPath: "inset(0 100% 0 0)",
          xPercent: 10,
          ease: "power3.out",
          duration: 0.75,
        },
        "start",
      )
      .to(
        [
          ...splits.textLeftSplits.flatMap((split) => split.lines),
          ...splits.textRightSplits.flatMap((split) => split.lines),
        ],
        {
          yPercent: 100,
          stagger: 0.025,
          duration: 0.75,
        },
        "start",
      )
      .add(() => {
        const contentWrapperImage =
          currentWrapper.querySelector(".image_container");
        if (!contentWrapperImage) return;
        const flipState = Flip.getState(contentWrapperImage);
        galleryImagesWrapper[index].appendChild(contentWrapperImage);
        Flip.from(flipState, {
          duration: 1.25,
          ease: "power3.inOut",
        });
      }, "start+=0.25")
      .to(
        gsap.utils
          .toArray(galleryImagesWrapper)
          .filter((img, i) => i !== index),
        {
          clipPath: "inset(0% 0 0 0)",
        },
      )
      .set(galleryImagesWrapper, {
        clipPath: "none",
      });
  };

  // Event Listeners
  galleryImagesWrapper.forEach((image, index) => {
    image.addEventListener("click", () => handleImageClick(index));
    image.addEventListener("touchstart", (e) => handleTouchStart(e, index));
    image.addEventListener("mouseenter", () =>
      cursor.classList.add("is-visible"),
    );
    image.addEventListener("mouseleave", () =>
      cursor.classList.remove("is-visible"),
    );
  });

  contentWrappers.forEach((content, index) => {
    content.addEventListener("click", () => handleWrapperClick(index));
    content.addEventListener("mouseenter", () =>
      cursor.classList.add("is-visible"),
    );
    content.addEventListener("mouseleave", () =>
      cursor.classList.remove("is-visible"),
    );
  });

  // Cleanup function
  function cleanup() {
    if (rafId) cancelAnimationFrame(rafId);
    window.removeEventListener("mousemove", handleMouseMove);
  }
  window.addEventListener("mousemove", handleMouseMove);
  window.addEventListener("unload", cleanup);
});
