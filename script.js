// --- 1. 설정: 여기에 API 키를 입력하세요 ---
const API_KEY = "AIzaSyDIqTnuRmi-96LE4efvz5F0rtOLBzGY5Vc";
// ------------------------------------

// DOM 요소 가져오기
const searchButton = document.getElementById("searchButton");
const searchTerm = document.getElementById("searchTerm");
const resultsDiv = document.getElementById("results");
const loadingDiv = document.getElementById("loading");

const playSelectedButton = document.getElementById("playSelectedButton");

const selectAllContainer = document.getElementById("selectAllContainer");
const selectAllCheckbox = document.getElementById("selectAllCheckbox");

const videoCountSpan = document.getElementById("videoCount");

// 필터 요소
const dateFilter = document.getElementById("dateFilter");
const customDateInputs = document.getElementById("customDateInputs");
const startDate = document.getElementById("startDate");
const endDate = document.getElementById("endDate");
const durationFilter = document.getElementById("durationFilter");
const avoidKeywordsInput = document.getElementById("avoidKeywords");
const avoidChannelsInput = document.getElementById("avoidChannels");

// 날짜 필터 '사용자 지정' 선택 시 입력창 표시
dateFilter.addEventListener("change", () => {
    if (dateFilter.value === "custom") {
        customDateInputs.classList.remove("hidden");
    } else {
        customDateInputs.classList.add("hidden");
    }
});

// 검색 버튼 클릭 이벤트
searchButton.addEventListener("click", () => {
    performSearch();
});
searchTerm.addEventListener("keyup", (event) => {
    if (event.key === "Enter") {
        performSearch();
    }
});

// 연속 재생 버튼 클릭 이벤트
playSelectedButton.addEventListener("click", () => {
    const checkedBoxes = document.querySelectorAll(".queue-checkbox:checked");
    if (checkedBoxes.length === 0) {
        alert("연속 재생할 영상을 1개 이상 선택하세요.");
        return;
    }
    const videoIds = Array.from(checkedBoxes).map(box => box.dataset.videoId);
    const videoIdString = videoIds.join(',');
    const playlistUrl = `https://www.youtube.com/watch_videos?video_ids=${videoIdString}`;
    window.open(playlistUrl, '_blank');
});


// 선택된/전체 영상 갯수 업데이트 함수
function updateVideoCount() {
    const selectedCount = document.querySelectorAll(".queue-checkbox:checked").length;
    const totalCount = document.querySelectorAll(".queue-checkbox").length;

    if (totalCount > 0) {
        videoCountSpan.textContent = `${selectedCount} / ${totalCount}`;
    } else {
        videoCountSpan.textContent = ""; // 결과 없으면 비움
    }
}

// '전체 선택' 체크박스 이벤트
selectAllCheckbox.addEventListener("change", () => {
    const allCheckboxes = document.querySelectorAll(".queue-checkbox");
    allCheckboxes.forEach(box => {
        box.checked = selectAllCheckbox.checked;
    });
    updateVideoCount(); // 카운터 업데이트
});

// 개별 체크박스 클릭 시 카운터 업데이트 (이벤트 위임)
resultsDiv.addEventListener("change", (event) => {
    if (event.target.classList.contains("queue-checkbox")) {
        updateVideoCount();
    }
});


// YouTube API 검색 실행 (수정)
async function performSearch() {
    let query = searchTerm.value; // ⭐️ 'const' -> 'let'으로 변경
    if (!query) {
        alert("검색어를 입력하세요.");
        return;
    }
    
    if (API_KEY === "[ 여기에_내_API_키를_입력하세요 ]" || API_KEY === "") {
        alert("script.js 파일에 YouTube API 키를 입력해야 합니다.");
        return;
    }

    // ⭐️ (추가) AND/OR 연산자 처리
    // 1. " or " (양쪽에 공백, 대소문자 무관) -> " | " (YouTube API OR 연산자)
    query = query.replace(/\s+or\s+/gi, " | ");
    // 2. " and " (양쪽에 공백, 대소문자 무관) -> " " (YouTube API 기본 AND 연산자)
    query = query.replace(/\s+and\s+/gi, " ");

    resultsDiv.innerHTML = "";
    videoCountSpan.textContent = ""; // 검색 시작 시 카운터 초기화
    loadingDiv.classList.remove("hidden");
    playSelectedButton.classList.add("hidden"); 
    selectAllContainer.classList.add("hidden"); 

    const params = new URLSearchParams({
        part: "snippet",
        q: query, // ⭐️ 수정된 검색어 사용
        type: "video",
        maxResults: 50, 
        key: API_KEY
    });

    // 날짜 필터 적용
    const dateValue = dateFilter.value;
    if (dateValue === "custom") {
        if (startDate.value) {
            params.set("publishedAfter", new Date(startDate.value).toISOString());
        }
        if (endDate.value) {
            params.set("publishedBefore", new Date(endDate.value).toISOString());
        }
    } else if (dateValue !== "all") {
        const afterDate = new Date();
        if (dateValue === "day") afterDate.setDate(afterDate.getDate() - 1);
        if (dateValue === "week") afterDate.setDate(afterDate.getDate() - 7);
        if (dateValue === "month") afterDate.setMonth(afterDate.getMonth() - 1);
        if (dateValue === "year") afterDate.setFullYear(afterDate.getFullYear() - 1);
        params.set("publishedAfter", afterDate.toISOString());
    }

    // 영상 길이 필터 적용
    const durationValue = durationFilter.value;
    if (durationValue !== "any") {
        params.set("videoDuration", durationValue);
    }

    // 2. API 호출
    try {
        const response = await fetch(`https://www.googleapis.com/youtube/v3/search?${params.toString()}`);
        if (!response.ok) {
            const errorData = await response.json();
            if (response.status === 403) {
                 throw new Error(`API 오류(403): API 키 할당량이 초과되었거나 권한이 없습니다.`);
            }
            throw new Error(`API 오류: ${errorData.error.message}`);
        }
        const data = await response.json();

        // 3. 클라이언트 측 필터링
        const filteredResults = filterClientSide(data.items);

        displayResults(filteredResults);

    } catch (error) {
        console.error(error);
        resultsDiv.innerHTML = `<p class="error">검색 중 오류가 발생했습니다: ${error.message}</p>`;
    } finally {
        loadingDiv.classList.add("hidden");
    }
}

// 기피 키워드/채널 필터링 함수
function filterClientSide(items) {
    const avoidKeywords = avoidKeywordsInput.value.split(",")
        .map(k => k.trim().toLowerCase()).filter(k => k);
    const avoidChannels = avoidChannelsInput.value.split(",")
        .map(c => c.trim().toLowerCase()).filter(c => c);

    if (avoidKeywords.length === 0 && avoidChannels.length === 0) {
        return items;
    }

    return items.filter(item => {
        const title = item.snippet.title.toLowerCase();
        const channel = item.snippet.channelTitle.toLowerCase();
        const hasAvoidKeyword = avoidKeywords.some(keyword => title.includes(keyword));
        if (hasAvoidKeyword) return false;
        const hasAvoidChannel = avoidChannels.some(channelName => channel.includes(channelName));
        if (hasAvoidChannel) return false;
        return true;
    });
}

// 검색 결과 화면에 표시
function displayResults(items) {
    if (items.length === 0) {
        resultsDiv.innerHTML = "<p>검색 결과가 없습니다. (필터 조건 포함)</p>";
        playSelectedButton.classList.add("hidden");
        selectAllContainer.classList.add("hidden"); 
        updateVideoCount(); // 카운터 0/0 -> ""으로 비우기
        return;
    }

    playSelectedButton.classList.remove("hidden");
    selectAllContainer.classList.remove("hidden"); 
    selectAllCheckbox.checked = false; 

    items.forEach(item => {
        const videoId = item.id.videoId;
        const title = item.snippet.title;
        const channel = item.snippet.channelTitle;
        const publishedAt = new Date(item.snippet.publishedAt).toLocaleDateString("ko-KR");
        const thumbnail = item.snippet.thumbnails.medium.url;

        const videoElement = `
            <div class="video-item">
                <input type="checkbox" class="queue-checkbox" data-video-id="${videoId}" title="연속 재생 목록에 추가">
                <a href="https://www.youtube.com/watch?v=${videoId}" target="_blank">
                    <img src="${thumbnail}" alt="${title}">
                </a>
                <div class="video-info">
                    <h3>
                        <a href="https://www.youtube.com/watch?v=${videoId}" target="_blank">${title}</a>
                    </h3>
                    <p><strong>채널:</strong> ${channel}</p>
                    <p><strong>게시일:</strong> ${publishedAt}</p>
                </div>
            </div>
        `;
        resultsDiv.innerHTML += videoElement;
    });

    // 모든 결과가 표시된 후, 카운터 초기화 (예: "0 / 30")
    updateVideoCount();

}
