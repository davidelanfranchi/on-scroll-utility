/* 
Smooth Scrollbar helper functions
https://github.com/idiotWu/smooth-scrollbar
*/

class FancyScrolling {
  constructor(options) {
    // Default options

    const defaults = {
      smoothScrollbar: undefined,
      smoothScrollbarContainer: undefined,
      smoothScrollbarInstance: undefined,
      containerElement: document.body,
      containerOffset: 0,
      itemsSelector: "[data-os]",
      isInViewportClass: "is-in-viewport",
      isStickToTopClass: "is-stick-to-top",
      parallaxSpeed: 0.1,
      breakPoint: 1025
    };

    // Assign passed options to class

    let opts = Object.assign({}, defaults, options);
    Object.keys(defaults).forEach(prop => {
      this[prop] = opts[prop];
    });

    // Init

    this.init();
  }

  init() {
    console.log("init");

    // Get browser transform property

    this.transformProperty = this.getTransformProperty();

    // Get RequestAnimationFrame prefix

    let vendors = ["webkit", "moz"];
    for (let x = 0; x < vendors.length && !window.requestAnimationFrame; ++x) {
      window.requestAnimationFrame =
        window[vendors[x] + "RequestAnimationFrame"];
      window.cancelAnimationFrame =
        window[vendors[x] + "CancelAnimationFrame"] ||
        window[vendors[x] + "CancelRequestAnimationFrame"];
    }

    // Set interface, based on browser width or options

    this.setInterface();

    // Create the data object

    this.data = { vertical: {}, horizontal: {}, isScrolling: false };

    // Cache dom elements

    this.cacheElements();

    // Start animation loop
    window.requestAnimationFrame(() => {
      this.update();
    });

    // Attach resize event listener
    window.addEventListener("resize", this.onResize.bind(this));

    // Force first calc

    this.setPositions(true);
  }

  setInterface() {
    if (
      this.smoothScrollbar !== undefined &&
      window.matchMedia(`(min-width: ${this.breakPoint}px)`).matches
    ) {
      if (this.smoothScrollbarInstance === undefined) {
        console.log("start smoot");
        this.smoothScrollbarInstance = this.smoothScrollbar.init(
          this.smoothScrollbarContainer
        );
        this.interface = "smoothScrollbar";
        this.scrollSource = this.smoothScrollbarInstance;
      }
    } else {
      if (this.smoothScrollbarInstance) {
        console.log("destroy smoot");
        this.smoothScrollbarInstance.destroy();
        this.smoothScrollbarInstance = undefined;
      }

      this.interface = "native";
      this.scrollSource = this.containerElement;
    }
  }

  getTransformProperty() {
    let testEl = document.createElement("div");
    if (testEl.style.transform === null) {
      let vendors = ["Webkit", "Moz", "ms"];
      for (let vendor of vendors) {
        if (testEl.style[vendors[vendor] + "Transform"] !== undefined) {
          return vendors[vendor] + "Transform";
        }
      }
    }
    return "transform";
  }

  update() {
    this.raf = window.requestAnimationFrame(() => {
      this.setPositions();
      this.update();
    });
  }

  cancelRaf() {
    console.log("cancelRaf");
    if (this.raf) {
      window.cancelAnimationFrame(this.raf);
    }
  }

  onResize() {
    clearTimeout(this.resizeTimeout);
    this.isResizing = true;
    this.resizeTimeout = setTimeout(() => {
      console.log("debounced onResize");
      this.setInterface();
      this.cacheElements();
      this.isResizing = false;
      this.setPositions(true);
    }, 250);
  }

  cacheElements() {
    this.cache = { container: {}, items: [] };

    // Get container data

    let contBounding = this.containerElement.getBoundingClientRect();

    this.cache.container = {
      element: this.containerElement,
      width:
        this.containerElement === document.body
          ? window.innerWidth
          : contBounding.width,
      height:
        this.containerElement === document.body
          ? window.innerHeight
          : contBounding.height
    };

    // Get scroll data

    this.data = this.getScrollData();

    // Get elements data

    document.querySelectorAll(this.itemsSelector).forEach((element, index) => {
      // Skip disabled elements

      if (element.hasAttribute("data-os-disabled")) {
        return;
      }

      // Clear styles and elements

      element.style[this.transformProperty] = "";
      if (element.hasAttribute("data-os-stick-to-top")) {
        element.style.position = "";
        element.style.top = "";
        element.style.bottom = "";
      }
      document.querySelectorAll("[data-os-dummy-element").forEach(element => {
        element.remove();
      });

      // Get element rect
      let elBounding = element.getBoundingClientRect();

      let item = {
        // dom reference
        element: element,
        isVisible: false,
        top: elBounding.top + this.data.vertical.position,
        right: elBounding.right + this.data.horizontal.position,
        bottom: elBounding.bottom + this.data.vertical.position,
        left: elBounding.left + this.data.horizontal.position,
        width: elBounding.width,
        height: elBounding.height,
        offset:
          parseInt(element.getAttribute("data-os-offset")) ||
          this.containerOffset,
        action: element.dataset.osAction,
        verticalParallax: element.hasAttribute("data-os-v-parallax")
          ? true
          : false,
        verticalParallaxSpeed:
          parseFloat(element.getAttribute("data-os-v-parallax")) ||
          this.parallaxSpeed,
        horizontalParallax: element.hasAttribute("data-os-h-parallax")
          ? true
          : false,
        horizontalParallaxSpeed:
          parseFloat(element.getAttribute("data-os-h-parallax")) ||
          this.parallaxSpeed,
        verticalProgressAction: element.getAttribute(
          "data-os-v-progress-action"
        ),
        once: element.hasAttribute("data-os-once") ? true : false,
        stickToTop: element.hasAttribute("data-os-stick-to-top") ? true : false,
        stickToTopParent: element.hasAttribute("data-os-stick-to-top-parent")
          ? document.querySelector(
              `[data-os-stick-parent="${element.getAttribute(
                "data-os-stick-to-top-parent"
              )}"]`
            )
          : false,
        stickToBottom: element.hasAttribute("data-os-stick-to-bottom")
          ? true
          : false,
        stickToBottomParent: element.hasAttribute(
          "data-os-stick-to-bottom-parent"
        )
          ? document.querySelector(
              `[data-os-parent-${element.getAttribute(
                "data-os-stick-to-bottom-parent"
              )}]`
            )
          : false
      };

      if (item.stickToTopParent) {
        item.stickToTopParentBottom =
          item.stickToTopParent.getBoundingClientRect().bottom +
          this.data.vertical.position;
      }

      this.cache.items.push(item);
    });

    console.log(this.cache);
  }

  setPositions(forceUpdate = false) {
    // Return if no elements in cache

    if (!this.cache) {
      return;
    }
    // Return if window is resizing

    if (this.resizing) {
      return;
    }

    // Get scroll data

    this.data = this.getScrollData();

    // Return if no scroll happened
    if (!this.data.isScrolling && !forceUpdate) {
      return;
    }

    // Loop cached items and make checks

    this.cache.items.forEach((item, index) => {
      // in view check

      let itemTopIsPassed =
        this.data.vertical.position >
        item.top - this.cache.container.height - item.offset;
      let itemBottomIsPassed =
        this.data.vertical.position > item.bottom + item.offset;

      let itemLeftIsPassed =
        this.data.horizontal.position >
        item.left - this.cache.container.width - item.offset;
      let itemRightIsPassed =
        this.data.horizontal.position > item.right + item.offset;

      let isInview =
        itemTopIsPassed &&
        !itemBottomIsPassed &&
        itemLeftIsPassed &&
        !itemRightIsPassed;

      if (isInview === true && item.isVisible == false) {
        this.elementEnterViewport(item);
      }
      if (isInview === false && item.isVisible == true) {
        this.elementExitVieport(item);
      }

      // Vertical progress action

      if (item.verticalProgressAction) {
        let progress =
          this.data.vertical.position -
          item.top +
          this.cache.container.height -
          item.offset;

        let percentage = Math.round(
          progress / (item.height + this.cache.container.height) * 100
        );

        if (percentage >= 0 && percentage <= 100) {
          item.percentage = percentage;
          this[item.verticalProgressAction](item);
        }
      }

      // Parallax transform

      let transformY;
      if (item.verticalParallax) {
        transformY = Math.round(
          (item.top - item.height / 2 - this.data.vertical.position) *
            item.verticalParallaxSpeed
        );
      } else {
        transformY = 0;
      }
      let transformX;
      if (item.horizontalParallax) {
        transformX = Math.round(
          (item.left - item.width / 2 - this.data.horizontal.position) *
            item.horizontalParallaxSpeed
        );
      } else {
        transformX = 0;
      }

      if (
        isInview === true &&
        (item.verticalParallax || item.horizontalParallax)
      ) {
        this.parallaxTransform(item, transformY, transformX);
      }

      // vertical sticky check

      if (item.stickToTop) {
        let isAtTop = this.data.vertical.position > item.top;
        if (isAtTop) {
          this.stickElementToTop(item);
        } else {
          this.unstickElementToTop(item);
        }
      }
    });
  }

  stickElementToTop(item) {
    console.log("strfg");
    item.element.classList.add(this.isStickToTopClass);

    let maxTopPosition = item.stickToTopParentBottom - item.height;
    let topPosition =
      this.data.vertical.position >= maxTopPosition
        ? maxTopPosition
        : this.data.vertical.position;

    if (this.interface === "smoothScrollbar") {
      // Fixed element relative to the transformed element that scroll
      item.element.style.position = "fixed";
      item.element.style.top = `${topPosition}px`;
    }

    if (this.interface === "native") {
      if (this.data.vertical.position <= maxTopPosition) {
        item.element.style.position = "fixed";
        item.element.style.top = `0px`;
      } else {
        item.element.style.position = "absolute";
        // item.element.style.top = `${topPosition}px`;
        item.element.style.top = ``;
        item.element.style.bottom = `0px`;
      }
    }

    // append dummy element

    if (!item.isStickyToTop) {
      let dummyEl = document.createElement("div");
      dummyEl.setAttribute("data-os-dummy-element", "");
      dummyEl.style.height = `${item.height}px`;
      item.element.after(dummyEl);
      item.stickyToTopDummyEl = dummyEl;
    }

    // flag
    item.isStickyToTop = true;
  }

  unstickElementToTop(item) {
    item.element.classList.remove(this.isStickToTopClass);

    item.element.style.position = "";
    item.element.style.top = "";
    // item.element.style.left = "";

    // item.element.style[this.transformProperty] = "";
    if (item.isStickyToTop) {
      item.stickyToTopDummyEl.remove();

      // flag
      item.isStickyToTop = false;
    }
  }

  parallaxTransform(item, transformY, transformX) {
    item.element.style[
      this.transformProperty
    ] = `translate3d(${transformX}px, ${transformY}px, 0)`;
  }

  getScrollTop() {
    if (
      this.interface === "native" &&
      this.containerElement === document.body
    ) {
      return (
        window.pageYOffset ||
        (document.documentElement && document.documentElement.scrollTop) ||
        document.body.scrollTop
      );
    } else {
      return this.scrollSource.scrollTop;
    }
  }

  getScrollLeft() {
    if (
      this.interface === "native" &&
      this.containerElement === document.body
    ) {
      return (
        window.pageXOffset ||
        (document.documentElement && document.documentElement.scrollLeft) ||
        document.body.scrollLeft
      );
    } else {
      return this.scrollSource.scrollLeft;
    }
  }

  getScrollSpeed() {
    return "speed";
  }

  getScrollDirection() {
    return "speed";
  }

  getScrollData() {
    let scrollTop = this.getScrollTop();
    let scrollLeft = this.getScrollLeft();

    let lastScrollTop = this.data.vertical.position || scrollTop;
    let lastScrollLeft = this.data.horizontal.position || scrollLeft;

    let verticalDifference = scrollTop - lastScrollTop;
    let horizontalDifference = scrollLeft - lastScrollLeft;

    return {
      vertical: {
        direction:
          verticalDifference === 0
            ? "unchanged"
            : verticalDifference > 0
              ? "down"
              : "up",
        speed: Math.abs(verticalDifference),
        position: scrollTop
      },
      horizontal: {
        direction:
          horizontalDifference === 0
            ? "unchanged"
            : horizontalDifference > 0
              ? "right"
              : "left",
        speed: Math.abs(horizontalDifference),
        position: scrollLeft
      },
      isScrolling:
        verticalDifference === 0 && horizontalDifference === 0 ? false : true
    };
  }

  elementEnterViewport(item) {
    // add flag
    item.isVisible = true;
    // add the general class
    item.element.classList.add(this.isInViewportClass);

    // trigger function
    if (item.action) {
      this[item.action](item);
    }
    // disable element
    if (item.once) {
      this.cache.items = this.disableElement(item);
    }
    // dev
    item.element.innerText = "in-viewport";
  }
  elementExitVieport(item) {
    // set flag
    item.isVisible = false;
    // remove the general class
    item.element.classList.remove(this.isInViewportClass);
    // dev
    item.element.innerText = "not-in-viewport";
  }

  disableElement(item) {
    item.element.setAttribute("data-os-disabled", "");
    return this.cache.items.filter(element => element !== item);
  }
}

class customFancyScrolling extends FancyScrolling {
  // Custom functions

  behaviour1(item) {
    console.log("behaviour1");
  }

  behaviour2(item) {
    console.log("behaviour2");
  }

  logProgress(item) {
    item.element.innerText = `${item.percentage}%`;
  }
}
