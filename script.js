// --- 1. 설정: 여기에 API 키를 입력하세요 ---
// ⚠️ 중요: 이 키는 절대로 공개적인 장소(예: GitHub 공개 저장소)에 직접 하드코딩하면 안 됩니다.
// 하지만 가족 공유용 비공개 프로젝트이므로, 우선 여기에 키를 넣어 테스트합니다.
const API_KEY = "AIzaSyDk-HBd4OTlv605jmu-REWKIAHgde8l2JQ"; // 
// ------------------------------------

// DOM 요소 가져오기
const searchButton = document.getElementById("searchButton");
const searchTerm = document.getElementById("searchTerm");
const resultsDiv = document.getElementById("results");
const loadingDiv = document.getElementById("loading");

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

// YouTube API 검색 실행
async function performSearch() {
    const query = searchTerm.value;
    if (!query) {
        alert("검색어를 입력하세요.");
        return;
    }
    
    // API 키 확인
    if (API_KEY === "[ 여기에_내_API_키를_입력하세요 ]" || API_KEY === "") {
        alert("script.js 파일에 YouTube API 키를 입력해야 합니다.");
        return;
    }

    resultsDiv.innerHTML = ""; // 이전 결과 지우기
    loadingDiv.classList.remove("hidden"); // 로딩 표시

    // 1. API 요청 파라미터 구성 (날짜, 길이 필터)
    const params = new URLSearchParams({
        part: "snippet",
        q: query,
        type: "video",
        maxResults: 25,
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
            throw new Error(`API 오류: ${errorData.error.message}`);
        }
        const data = await response.json();

        // 3. 클라이언트 측 필터링 (기피 키워드, 기피 채널) [cite: 10]
        const filteredResults = filterClientSide(data.items);

        displayResults(filteredResults);

    } catch (error) {
        console.error(error);
        resultsDiv.innerHTML = `<p class="error">검색 중 오류가 발생했습니다: ${error.message}</p>`;
    } finally {
        loadingDiv.classList.add("hidden"); // 로딩 숨기기
    }
}

// 기피 키워드/채널 필터링 함수
function filterClientSide(items) {
    // 쉼표(,)를 기준으로 배열 생성 및 공백 제거
    const avoidKeywords = avoidKeywordsInput.value.split(",")
        .map(k => k.trim().toLowerCase()).filter(k => k);
    const avoidChannels = avoidChannelsInput.value.split(",")
        .map(c => c.trim().toLowerCase()).filter(c => c);

    if (avoidKeywords.length === 0 && avoidChannels.length === 0) {
        return items; // 필터링할 내용이 없으면 원본 반환
    }

    return items.filter(item => {
        const title = item.snippet.title.toLowerCase();
        const channel = item.snippet.channelTitle.toLowerCase();

        // 기피 키워드 검사 (하나라도 포함되면 true 반환)
        const hasAvoidKeyword = avoidKeywords.some(keyword => title.includes(keyword));
        if (hasAvoidKeyword) return false; // 기피 키워드 포함 시 제외

        // 기피 채널 검사 (하나라도 포함되면 true 반환)
        const hasAvoidChannel = avoidChannels.some(channelName => channel.includes(channelName));
        if (hasAvoidChannel) return false; // 기피 채널 포함 시 제외

        return true; // 모든 필터를 통과
    });
}

// 검색 결과 화면에 표시
function displayResults(items) {
    if (items.length === 0) {
        resultsDiv.innerHTML = "<p>검색 결과가 없습니다. (필터 조건 포함)</p>";
        return;
    }

    items.forEach(item => {
        const videoId = item.id.videoId;
        const title = item.snippet.title;
        const channel = item.snippet.channelTitle;
        const publishedAt = new Date(item.snippet.publishedAt).toLocaleDateString("ko-KR");
        const thumbnail = item.snippet.thumbnails.medium.url;

        const videoElement = `
            <div class="video-item">
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
}