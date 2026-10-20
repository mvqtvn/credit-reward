let currentStudent;

try {
    currentStudent = JSON.parse(sessionStorage.getItem("currentStudent"));
} catch (error) {
    console.error("Unable to read the signed-in student:", error);
}

if (!currentStudent || typeof currentStudent.email !== "string") {
    sessionStorage.removeItem("currentStudent");
    window.location.replace("../signin/index.html");
} else {
    document.getElementById("studentEmail").textContent = currentStudent.email;
    document.getElementById("studentUniqueId").textContent = currentStudent.rfid_uid || "Not available";
}

document.querySelector(".logout-button").addEventListener("click", () => {
    sessionStorage.removeItem("currentStudent");
    window.location.replace("../signin/index.html");
});
