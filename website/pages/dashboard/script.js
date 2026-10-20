// GREETING
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

let currentStudent = null;
const apiBaseUrl = window.location.port === "3000" ? "" : "http://localhost:3000";
try {
    currentStudent = JSON.parse(sessionStorage.getItem("currentStudent"));
} catch (error) {
    console.error("Unable to read the signed-in student:", error);
    sessionStorage.removeItem("currentStudent");
}

if (currentStudent && Number.isFinite(Number(currentStudent.credit))) {
    document.getElementById("ecoCoinBalance").textContent = currentStudent.credit;
}
if (currentStudent && Number.isFinite(Number(currentStudent.drinks_bought))) {
    document.getElementById("drinksBought").textContent = currentStudent.drinks_bought;
}

if (currentStudent && typeof currentStudent.email === "string") {
    fetch(`${apiBaseUrl}/api/students/${currentStudent.student_id}`)
        .then(async response => {
            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.error || "Unable to refresh student details.");
            }
            if (!result.student || typeof result.student.email !== "string") {
                throw new Error("The sign-in service returned incomplete student details.");
            }
            return result.student;
        })
        .then(student => {
            currentStudent = student;
            sessionStorage.setItem("currentStudent", JSON.stringify(student));
            document.getElementById("ecoCoinBalance").textContent = student.credit;
            document.getElementById("drinksBought").textContent = student.drinks_bought;
        })
        .catch(error => {
            console.error("Unable to refresh dashboard balances:", error);
        });
}


// NOTIFS
let notifications = [];

const notificationBtn = document.getElementById("notificationBtn");
const notificationPanel = document.getElementById("notificationPanel");
const closeBtn = document.getElementById("closeNotifications");
const notificationList = document.getElementById("notificationList");

// toggle when clicked
notificationBtn.addEventListener("click", function () {
    notificationPanel.classList.toggle("active");
});
// close when clicked
closeBtn.addEventListener("click", function () {
    notificationPanel.classList.remove("active");
});
document.addEventListener("click", function (event) {
    if (!event.target.closest(".notification-btn") && !event.target.closest(".notification-panel")) {
        notificationPanel.classList.remove("active");
    }
});

// get notif (API)
function fetchNotifications(studentId) {
    fetch(`${apiBaseUrl}/api/notifications/${studentId}`)
        .then(async response => {
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || "Unable to load notifications.");
            }
            return data;
        })
        .then(data => {
            notifications = data;
            displayNotifications();
        })
        .catch(error => {
            console.error("Error fetching notifications:", error);
            notificationList.innerHTML = '<div class="notification-empty">Failed to load notifications</div>';
        });
}
// display notifs
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

if (currentStudent && currentStudent.student_id) {
    fetchNotifications(currentStudent.student_id);
} else {
    notificationList.innerHTML = '<div class="notification-empty">Sign in to view your notifications</div>';
}

// news button
document.getElementById("newsBtn").addEventListener("click", function () {
    window.open("https://www.straitstimes.com/singapore/environment", "_blank");
});
