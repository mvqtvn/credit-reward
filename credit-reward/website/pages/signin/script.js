// -------------------- Background Slideshow --------------------
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


// -------------------- Email Popup + RFID Flow --------------------
const emailPopupBtn = document.getElementById('emailPopupBtn');
const emailModal = document.getElementById('emailModal');
const closeModal = document.getElementById('closeModal');
const emailForm = document.getElementById('emailForm');

const rfidModal = document.getElementById('rfidModal');
const closeRfidModal = document.getElementById('closeRfidModal');
const rfidForm = document.getElementById('rfidForm');

let currentEmail = null;

// Open email modal
emailPopupBtn.addEventListener('click', () => {
  emailModal.style.display = 'flex';
});

// Close email modal
closeModal.addEventListener('click', () => {
  emailModal.style.display = 'none';
});

// Handle email submission
emailForm.addEventListener('submit', function(event) {
  event.preventDefault();
  currentEmail = document.getElementById('emailInput').value;

  if (!currentEmail) {
    alert("Please enter your email.");
    return;
  }

  // Close email modal and open RFID modal
  emailModal.style.display = 'none';
  rfidModal.style.display = 'flex';
});

// Close RFID modal
closeRfidModal.addEventListener('click', () => {
  rfidModal.style.display = 'none';
});

// Handle RFID submission
rfidForm.addEventListener('submit', function(event) {
  event.preventDefault();
  const rfidValue = document.getElementById('rfidInput').value;

  if (!rfidValue) {
    alert("Please enter your RFID UID.");
    return;
  }


    window.location.href = "../dashboard/index.html";


});