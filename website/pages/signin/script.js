const backgroundImages = [
    '/assests/images/slideshow/nj3.jpeg',
    '/assests/images/slideshow/nj4.jpeg',
    '/assests/images/slideshow/nj5.jpeg',
    '/assests/images/slideshow/nj6.jpeg',
    '/assests/images/slideshow/nj7.jpeg',
    '/assests/images/slideshow/nj9.jpeg'
];

const container = document.querySelector('.container');
const googleSignInBtn = document.getElementById('googleSignInBtn');
const overlayOne = document.createElement('div');
const overlayTwo = document.createElement('div');

let currentImageIndex = 0;
let currentLayer = overlayOne;
let isTransitioning = false;

[overlayOne, overlayTwo].forEach((overlay) => {
    overlay.className = 'slideshow-layer';
    overlay.style.backgroundSize = 'cover';
    overlay.style.backgroundPosition = 'center';
    overlay.style.backgroundRepeat = 'no-repeat';
    container.appendChild(overlay);
});

if (googleSignInBtn) {
    googleSignInBtn.addEventListener('click', function (event) {
        event.preventDefault();

        const signInUrl = 'https://accounts.google.com/';
        const popup = window.open(signInUrl, '_blank', 'width=500,height=700,noopener,noreferrer');

        if (!popup) {
            window.location.href = signInUrl;
        }
    });
}

function changeBackgroundImage() {
    if (isTransitioning) return;

    isTransitioning = true;
    const nextIndex = (currentImageIndex + 1) % backgroundImages.length;
    const incomingLayer = currentLayer === overlayOne ? overlayTwo : overlayOne;
    const outgoingLayer = currentLayer;

    incomingLayer.style.backgroundImage = `linear-gradient(180deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.08) 100%), url('${backgroundImages[nextIndex]}')`;
    incomingLayer.classList.add('active');
    outgoingLayer.classList.remove('active');

    setTimeout(() => {currentLayer = incomingLayer; currentImageIndex = nextIndex; isTransitioning = false;}, 1300);
}

container.classList.add('background-image');
overlayOne.style.backgroundImage = `linear-gradient(180deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.08) 100%), url('${backgroundImages[0]}')`;
overlayOne.classList.add('active');

setInterval(changeBackgroundImage, 7000);
