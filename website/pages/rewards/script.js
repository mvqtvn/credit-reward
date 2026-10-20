let currentImages = [];
let currentImageIndex = 0;
let selectedRewardId = null;
let rewardsById = new Map();
const fallbackImage = "../../assets/images/njclogo.png";
const student = getCurrentStudent();
const purchaseButton = document.getElementById("purchaseButton");
const houseDesignField = document.getElementById("houseDesignField");
const houseDesignSelect = document.getElementById("houseDesign");
const apiBaseUrl = window.location.port === "3000" ? "" : "http://localhost:3000";

function getCurrentStudent() {
  try {
    return JSON.parse(sessionStorage.getItem("currentStudent"));
  } catch (error) {
    console.error("Unable to read the signed-in student:", error);
    sessionStorage.removeItem("currentStudent");
    return null;
  }
}

async function loadRewards() {
  const contentContainer = document.querySelector(".content");
  try {
    const response = await fetch(`${apiBaseUrl}/api/rewards`);
    const rewards = await response.json();
    if (!response.ok || !Array.isArray(rewards)) {
      throw new Error(rewards.error || "Unable to load rewards.");
    }
    renderRewards(rewards);
  } catch (error) {
    console.error("Error fetching rewards:", error);
    contentContainer.textContent = "Unable to load rewards. Please try again later.";
  }
}

function renderRewards(rewards) {
  const contentContainer = document.querySelector(".content");
  contentContainer.replaceChildren();
  rewardsById = new Map(rewards.map(reward => [Number(reward.reward_id), reward]));

  rewards.forEach(reward => {
    const imagesArray = Array.isArray(reward.image_urls) ? reward.image_urls : [];
    const card = document.createElement("button");
    card.className = "card";
    card.type = "button";
    card.addEventListener("click", () => openDetails(reward.reward_id));

    const imageWrapper = document.createElement("span");
    imageWrapper.className = "card-image-wrapper";
    const image = document.createElement("img");
    image.className = "card-image";
    image.alt = reward.reward_name;
    setImageSource(image, imagesArray[0] || fallbackImage);
    imageWrapper.append(image);

    const info = document.createElement("span");
    info.className = "card-info";
    const name = document.createElement("span");
    name.textContent = reward.reward_name;
    const price = document.createElement("span");
    price.textContent = `${reward.cost} credits`;
    info.append(name, price);

    card.append(imageWrapper, info);
    contentContainer.append(card);
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

function openDetails(rewardId) {
  const reward = rewardsById.get(Number(rewardId));
  if (!reward) {
    return;
  }

  selectedRewardId = Number(reward.reward_id);
  const price = `${reward.cost} credits`;
  const images = Array.isArray(reward.image_urls) ? reward.image_urls : [];
  currentImages = images.length > 0 ? images : [fallbackImage];
  const detailsImageIndex = currentImages.findIndex(image => image.includes("_details."));
  currentImageIndex = detailsImageIndex === -1 ? 0 : detailsImageIndex;

  document.getElementById("modalTitle").textContent = reward.reward_name;
  document.getElementById("modalPrice").textContent = price;
  document.getElementById("modalStock").textContent = `${reward.stock} available`;
  document.getElementById("modalDescription").textContent =
    reward.description || "No description provided.";
  const needsHouseDesign = ["keychains", "socks", "stickers"]
    .includes(reward.reward_name.toLowerCase());
  houseDesignField.hidden = !needsHouseDesign;
  houseDesignSelect.required = needsHouseDesign;
  houseDesignSelect.value = "";
  document.getElementById("purchaseStatus").textContent = student
    ? `Your balance: ${student.credit} credits`
    : "Sign in to purchase this reward.";
  purchaseButton.disabled = !student || reward.stock <= 0;
  purchaseButton.textContent = reward.stock <= 0 ? "Out of stock" : "Purchase reward";

  updateCarouselImage();
  document.getElementById("detailsOverlay").classList.add("active");
}

function updateCarouselImage() {
  const imgElement = document.getElementById("modalImage");
  const prevBtn = document.querySelector(".prev-btn");
  const nextBtn = document.querySelector(".next-btn");
  setImageSource(imgElement, currentImages[currentImageIndex]);

  prevBtn.style.display = currentImages.length <= 1 ? "none" : "flex";
  nextBtn.style.display = currentImages.length <= 1 ? "none" : "flex";
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
  if (event.target === document.getElementById("detailsOverlay")) {
    document.getElementById("detailsOverlay").classList.remove("active");
  }
}

async function purchaseSelectedReward() {
  const reward = rewardsById.get(selectedRewardId);
  if (!student || !student.student_id || !reward || purchaseButton.disabled) {
    return;
  }
  const houseDesign = houseDesignField.hidden ? null : houseDesignSelect.value;
  if (!houseDesignField.hidden && !houseDesign) {
    document.getElementById("purchaseStatus").textContent = "Choose a house design before purchasing.";
    houseDesignSelect.focus();
    return;
  }
  const designDescription = houseDesign ? ` with the ${houseDesign} design` : "";
  if (!window.confirm(`Purchase ${reward.reward_name}${designDescription} for ${reward.cost} credits?`)) {
    return;
  }

  purchaseButton.disabled = true;
  const status = document.getElementById("purchaseStatus");
  status.textContent = "Processing your purchase...";
  try {
    const response = await fetch(`${apiBaseUrl}/api/redemptions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studentId: student.student_id,
        rewardId: reward.reward_id,
        houseDesign
      })
    });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || "Unable to complete this purchase.");
    }

    student.credit = result.creditBalance;
    sessionStorage.setItem("currentStudent", JSON.stringify(student));
    reward.stock -= 1;
    document.getElementById("modalStock").textContent = `${reward.stock} available`;
    document.getElementById("modalPrice").textContent = `${reward.cost} credits`;
    status.textContent = result.csvSynced
      ? `${reward.reward_name} purchased. Your balance is ${result.creditBalance} credits.`
      : `${reward.reward_name} purchased, but the redemption CSV could not be updated.`;
    purchaseButton.disabled = reward.stock <= 0;
    if (reward.stock <= 0) {
      purchaseButton.textContent = "Out of stock";
    }
    await loadUnredeemedRewards();
  } catch (error) {
    console.error("Unable to purchase reward:", error);
    status.textContent = error.message;
    purchaseButton.disabled = false;
  }
}

async function loadUnredeemedRewards() {
  const status = document.getElementById("unredeemedStatus");
  const list = document.getElementById("unredeemedRewards");
  list.replaceChildren();

  if (!student || !student.student_id) {
    status.textContent = "Sign in to view your unredeemed rewards.";
    return;
  }

  try {
    const response = await fetch(`${apiBaseUrl}/api/redemptions/${student.student_id}`);
    const redemptions = await response.json();
    if (!response.ok || !Array.isArray(redemptions)) {
      throw new Error(redemptions.error || "Unable to load unredeemed rewards.");
    }
    if (redemptions.length === 0) {
      status.textContent = "You have no unredeemed rewards.";
      return;
    }

    status.textContent = "";
    redemptions.forEach(redemption => {
      const item = document.createElement("li");
      item.className = "unredeemed-item";
      const name = document.createElement("strong");
      name.textContent = redemption.rewardName;
      const cost = document.createElement("span");
      cost.textContent = `${redemption.cost} credits`;
      if (redemption.houseDesign) {
        const design = document.createElement("span");
        design.textContent = `${redemption.houseDesign} design`;
        item.append(name, design, cost);
      } else {
        item.append(name, cost);
      }
      const state = document.createElement("span");
      state.className = "unredeemed-badge";
      state.textContent = redemption.status;
      item.append(state);
      list.append(item);
    });
  } catch (error) {
    console.error("Unable to load unredeemed rewards:", error);
    status.textContent = "Unable to load your unredeemed rewards. Please try again later.";
  }
}

purchaseButton.addEventListener("click", purchaseSelectedReward);
loadRewards();
loadUnredeemedRewards();
