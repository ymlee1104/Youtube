// --- 1. 설정: 여기에 API 키를 입력하세요 ---
const API_KEY = "AIzaSyDk-HBd4OTlv605jmu-REWKIAHgde8l2JQ";
// ------------------------------------

// ⭐️ (제거) 플레이어 관련 전역 변수 모두 삭제
// var player;
// var ytApiReady = false;
// var currentPlaylist = [];
// var currentVideoIndex = 0;

// ⭐️ (제거) YouTube IFrame API 관련 함수 모두 삭제
// function onYouTubeIframeAPIReady() {}
// function onPlayerStateChange(event) {}

// DOM 요소 가져오기
const searchButton = document.getElementById("searchButton");
const searchTerm = document.getElementById("searchTerm");
const resultsDiv = document.getElementById("results");
const loadingDiv = document.getElementById("loading");

const playSelectedButton = document.getElementById("playSelectedButton");
// ⭐️ (제거) const playerModal = document.getElementById("playerModal");
// ⭐️ (제거) const closeModal = document.getElementById("closeModal");

const selectAllContainer = document.getElementById("selectAllContainer");
const selectAllCheckbox = document.getElementById("selectAllCheckbox");

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

// ⭐️ (수정) 연속 재생 버튼 클릭 이벤트
playSelectedButton.addEventListener("click", () => {
    const checkedBoxes = document.querySelectorAll(".queue-checkbox:checked");
    if (checkedBoxes.length === 0) {
        alert("연속 재생할 영상을 1개 이상 선택하세요.");
        return;
    }

    // 1. 체크된 모든 비디오 ID 수집
    const videoIds = Array.from(checkedBoxes).map(box => box.dataset.videoId);
    
    // 2. 쉼표(,)로 ID 목록을 연결
    const videoIdString = videoIds.join(',');

    // 3. YouTube '임시 재생목록' URL 생성
    // 이 URL은 선택된 영상들로 재생목록을 만들어 youtube.com에서 바로 재생합니다.
    const playlistUrl = `https://www.youtube.com/watch_videos?video_ids=${videoIdString}`;

    // 4. 새 탭에서 URL 열기
    window.open(playlistUrl, '_blank');
});

// ⭐️ (제거) 모달 닫기 버튼 이벤트 삭제
// closeModal.addEventListener("click", () => { ... });

// '전체 선택' 체크박스 이벤트
selectAllCheckbox.addEventListener("change", () => {
    const allCheckboxes = document.querySelectorAll(".queue-checkbox");
    allCheckboxes.forEach(box => {
        box.checked = selectAllCheckbox.checked;
    });
});

// ⭐️ (제거) playVideoQueue 함수 삭제
// function playVideoQueue(firstVideoId) { ... }


// YouTube API 검색 실행 (수정)
async function performSearch() {
    const query = searchTerm.value;
    if (!query) {
        alert("검색어를 입력하세요.");
        return;
    }
    
    if (API_KEY === "[ 여기에_내_API_키를_입력하세요 ]" || API_KEY === "") {
        alert("script.js 파일에 YouTube API 키를 입력해야 합니다.");
        return;
    }

    resultsDiv.innerHTML = "";
    loadingDiv.classList.remove("hidden");
    playSelectedButton.classList.add("hidden"); 
    selectAllContainer.classList.add("hidden"); 

    // '영상 유형' 필터 로직 (제거됨)

    // 1. API 요청 파라미터 구성
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

// 기피 키워드/채널 필터링 함수 (동일)
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

// 검색 결과 화면에 표시 (동일)
function displayResults(items) {
    if (items.length === 0) {
        resultsDiv.innerHTML = "<p>검색 결과가 없습니다. (필터 조건 포함)</p>";
        playSelectedButton.classList.add("hidden");
        selectAllContainer.classList.add("hidden"); 
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
}