// Background Slideshow
  const backgroundImages = [
    '../../assets/images/slideshow/nj3.jpeg',
    '../../assets/images/slideshow/nj4.jpeg',
    '../../assets/images/slideshow/nj5.jpeg',
    '../../assets/images/slideshow/nj6.jpeg',
    '../../assets/images/slideshow/nj7.jpeg',
    '../../assets/images/slideshow/nj9.jpeg'
  ];

  const container = document.querySelector('.container');
  const overlayOne = document.createElement('div');
  const overlayTwo = document.createElement('div');

  let currentImageIndex = 0;
  let currentLayer = overlayOne;
  let isTransitioning = false;

  // Setup slideshow layers
  [overlayOne, overlayTwo].forEach((overlay) => {
    overlay.className = 'slideshow-layer';
    overlay.style.backgroundSize = 'cover';
    overlay.style.backgroundPosition = 'center';
    overlay.style.backgroundRepeat = 'no-repeat';
    container.appendChild(overlay);
  });

  function changeBackgroundImage() {
    if (isTransitioning) return;

    isTransitioning = true;
    const nextIndex = (currentImageIndex + 1) % backgroundImages.length;
    const incomingLayer = currentLayer === overlayOne ? overlayTwo : overlayOne;
    const outgoingLayer = currentLayer;

    incomingLayer.style.backgroundImage =
      `linear-gradient(180deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.08) 100%), url('${backgroundImages[nextIndex]}')`;
    incomingLayer.classList.add('active');
    outgoingLayer.classList.remove('active');

    setTimeout(() => {
      currentLayer = incomingLayer;
      currentImageIndex = nextIndex;
      isTransitioning = false;
    }, 1300);
  }

  // Initialize slideshow
  container.classList.add('background-image');
  overlayOne.style.backgroundImage =
    `linear-gradient(180deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.08) 100%), url('${backgroundImages[0]}')`;
  overlayOne.classList.add('active');

  setInterval(changeBackgroundImage, 7000);


// Email-only student sign-in
const emailPopupBtn = document.getElementById('emailPopupBtn');
const emailModal = document.getElementById('emailModal');
const closeModal = document.getElementById('closeModal');
const emailForm = document.getElementById('emailForm');

const emailStatus = document.getElementById('emailStatus');
const authApiUrl = 'http://localhost:3000/api/auth/signin';

emailPopupBtn.addEventListener('click', () => {
  emailModal.style.display = 'flex';
});

closeModal.addEventListener('click', () => {
  emailModal.style.display = 'none';
});

// Handle email submission
emailForm.addEventListener('submit', function(event) {
  event.preventDefault();
  const email = document.getElementById('emailInput').value.trim().toLowerCase();

  if (!email) {
    emailStatus.textContent = "Please enter your email.";
    return;
  }

  const submitButton = emailForm.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  emailStatus.textContent = "Checking your student account...";

  fetch(authApiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email })
  })
    .then(async response => {
      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        throw new Error("The sign-in service returned an invalid response. Make sure the backend is running on localhost:3000.");
      }

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Unable to sign in. Please try again.");
      }
      return result.student;
    })
    .then(student => {
      sessionStorage.setItem("currentStudent", JSON.stringify(student));
      window.location.href = "../dashboard/index.html";
    })
    .catch(error => {
      emailStatus.textContent = error instanceof TypeError
        ? "Unable to reach the sign-in service. Make sure the backend is running on localhost:3000."
        : error.message;
      emailStatus.classList.add("is-error");
    })
    .finally(() => {
      submitButton.disabled = false;
    });
});