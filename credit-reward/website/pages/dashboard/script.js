// greeting
function updateGreeting() {
    const hour = new Date().getHours();
    const greetingElement = document.getElementById("greeting");
    
    if (hour >= 5 && hour < 12) {
        greetingElement.textContent = "Good Morning!";
    } else if (hour >= 12 && hour < 17) {
        greetingElement.textContent = "Good Afternoon!";
    } else {
        greetingElement.textContent = "Good evening!";
    }
}
// updates greeting on page load
updateGreeting();

// Notifications array (will be populated from API)
let notifications = [];

// Notification panel functionality
const notificationBtn = document.getElementById("notificationBtn");
const notificationPanel = document.getElementById("notificationPanel");
const closeBtn = document.getElementById("closeNotifications");
const notificationList = document.getElementById("notificationList");

// Toggle notification panel
notificationBtn.addEventListener("click", function () {
    notificationPanel.classList.toggle("active");
});

// Close notification panel
closeBtn.addEventListener("click", function () {
    notificationPanel.classList.remove("active");
});

// Close notification panel when clicking outside
document.addEventListener("click", function (event) {
    if (!event.target.closest(".notification-btn") && !event.target.closest(".notification-panel")) {
        notificationPanel.classList.remove("active");
    }
});

// Fetch notifications from API
function fetchNotifications(studentId = 1) {
    // Replace student_id=1 with actual student ID from session/localStorage
    fetch(`/api/notifications/${studentId}`)
        .then(response => response.json())
        .then(data => {
            notifications = data;
            displayNotifications();
        })
        .catch(error => {
            console.error("Error fetching notifications:", error);
            notificationList.innerHTML = '<div class="notification-empty">Failed to load notifications</div>';
        });
}

// Populate notifications
function displayNotifications() {
    if (notifications.length === 0) {
        notificationList.innerHTML = '<div class="notification-empty">No notifications yet</div>';
        return;
    }
    
    notificationList.innerHTML = notifications.map((notif, index) => `
        <div class="notification-item ${notif.type}" onclick="showNotificationDetails(${index})">
            <div class="notification-type">${notif.type === "earned" ? "+ Credit Earned" : "- Credit Spent"}</div>
            <div class="notification-description">${notif.description}</div>
            <div class="notification-amount">${notif.amount} EcoCoins</div>
            <div class="notification-time">${notif.time}</div>
        </div>
    `).join("");
}

// Show detailed notification
function showNotificationDetails(index) {
    const notif = notifications[index];
    alert(`${notif.type === "earned" ? "Credit Earned" : "Credit Spent"}\n\n${notif.description}\nAmount: ${notif.amount} EcoCoins\nDate: ${notif.date}\nTime: ${notif.time}`);
}

// Fetch notifications on page load with student_id=1 (change as needed)
fetchNotifications(1);

document.getElementById("newsBtn").addEventListener("click", function () {
    window.open("https://www.straitstimes.com/singapore/environment", "_blank");
});
