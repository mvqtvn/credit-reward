let currentImages = [];
let currentImageIndex = 0;
const fallbackImage = "../../assets/images/njclogo.png";

// Fetch rewards dynamically from the backend server when the page loads
document.addEventListener("DOMContentLoaded", () => {
  fetch("http://localhost:3000/api/rewards")
    .then(response => response.json())
    .then(rewards => {
      renderRewards(rewards);
    })
    .catch(error => console.error("Error fetching rewards:", error));
});

function renderRewards(rewards) {
  const contentContainer = document.querySelector(".content");
  contentContainer.innerHTML = ""; // Clear container

  rewards.forEach(reward => {
    const priceDisplay = `${reward.cost} credits`; // Matches your new 'cost' column
    const stockDisplay = `${reward.stock} available`;
    const imagesArray = Array.isArray(reward.image_urls) ? reward.image_urls : [];
    const defaultImage = imagesArray[0] || fallbackImage;

    // Create card element dynamically
    const card = document.createElement("div");
    card.className = "card";
    card.setAttribute("onclick", "openDetails(this)");
    card.setAttribute("data-title", reward.reward_name);
    card.setAttribute("data-price", priceDisplay);
    card.setAttribute("data-stock", stockDisplay);
    card.setAttribute("data-description", reward.description || "No description provided.");
    card.setAttribute("data-images", JSON.stringify(imagesArray));

    card.innerHTML = `
      <div class="card-image-wrapper">
        <img class="card-image" alt="${reward.reward_name}">
      </div>
      <div class="card-info">
        <span>${reward.reward_name}</span>
        <span>${priceDisplay}</span>
      </div>
    `;

    setImageSource(card.querySelector(".card-image"), defaultImage);
    contentContainer.appendChild(card);
  });
}

function setImageSource(imgElement, source) {
  imgElement.onerror = () => {
    imgElement.onerror = null;
    imgElement.src = fallbackImage;
  };
  const imageSource = source && source.startsWith("/assets/")
    ? `../../${source.slice(1)}`
    : source;
  imgElement.src = imageSource || fallbackImage;
}

function openDetails(cardElement) {
  const title = cardElement.getAttribute('data-title');
  const price = cardElement.getAttribute('data-price');
  const stock = cardElement.getAttribute('data-stock');
  const description = cardElement.getAttribute('data-description');
  
  currentImages = JSON.parse(cardElement.getAttribute('data-images'));
  const detailsImageIndex = currentImages.findIndex(image => image.includes("_details."));
  currentImageIndex = detailsImageIndex === -1 ? 0 : detailsImageIndex;

  document.getElementById('modalTitle').innerText = title;
  document.getElementById('modalPrice').innerText = price;
  document.getElementById('modalStock').innerText = stock;
  document.getElementById('modalDescription').innerText = description;
  
  updateCarouselImage();
  document.getElementById('detailsOverlay').classList.add('active');
}

function updateCarouselImage() {
  const imgElement = document.getElementById('modalImage');
  const prevBtn = document.querySelector('.prev-btn');
  const nextBtn = document.querySelector('.next-btn');

  setImageSource(imgElement, currentImages[currentImageIndex]);

  if (currentImages.length <= 1) {
    prevBtn.style.display = 'none';
    nextBtn.style.display = 'none';
  } else {
    prevBtn.style.display = 'flex';
    nextBtn.style.display = 'flex';
  }
}

function changePhoto(direction) {
  if (currentImages.length <= 1) return;

  currentImageIndex += direction;

  if (currentImageIndex < 0) {
    currentImageIndex = currentImages.length - 1;
  } else if (currentImageIndex >= currentImages.length) {
    currentImageIndex = 0;
  }

  updateCarouselImage();
}

function closeDetails(event) {
  if (event.target === document.getElementById('detailsOverlay')) {
    document.getElementById('detailsOverlay').classList.remove('active');
  }
}