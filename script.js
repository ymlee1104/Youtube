// (기존) DOM 요소
const searchButton = document.getElementById("searchButton");
const searchTerm = document.getElementById("searchTerm");
const resultsDiv = document.getElementById("results");
const loadingDiv = document.getElementById("loading");
const playSelectedButton = document.getElementById("playSelectedButton");
const selectAllContainer = document.getElementById("selectAllContainer");
const selectAllCheckbox = document.getElementById("selectAllCheckbox");
const videoCountSpan = document.getElementById("videoCount");

// (기존) 필터 요소
const dateFilter = document.getElementById("dateFilter");
const customDateInputs = document.getElementById("customDateInputs");
const startDate = document.getElementById("startDate");
const endDate = document.getElementById("endDate");
const durationFilter = document.getElementById("durationFilter");
const aspectRatioFilter = document.getElementById("aspectRatioFilter");

// (기존) 통계 필터 요소
const minViewsInput = document.getElementById("minViews");
const minLikesInput = document.getElementById("minLikes");
const minSubscribersInput = document.getElementById("minSubscribers");

// (기존) 설정 패널 요소
const toggleSettingsButton = document.getElementById("toggleSettingsButton");
const settingsPanel = document.getElementById("settingsPanel");
const saveSettingsButton = document.getElementById("saveSettingsButton");
const apiKeyInput = document.getElementById("apiKey");
const avoidKeywordsInput = document.getElementById("avoidKeywords"); 
const avoidChannelsInput = document.getElementById("avoidChannels"); 


// (기존) 페이지 로드 시 설정 불러오기
document.addEventListener("DOMContentLoaded", () => {
    try {
        const savedKey = localStorage.getItem("youtubeApiKey");
        const savedKeywords = localStorage.getItem("youtubeAvoidKeywords");
        const savedChannels = localStorage.getItem("youtubeAvoidChannels");

        if (savedKey) apiKeyInput.value = savedKey;
        if (savedKeywords) avoidKeywordsInput.value = savedKeywords;
        if (savedChannels) avoidChannelsInput.value = savedChannels;
    } catch (e) {
        console.error("localStorage 읽기 실패:", e);
        alert("설정(API 키 등)을 불러오는데 실패했습니다.");
    }
});

// (기존) 설정 패널 토글
toggleSettingsButton.addEventListener("click", () => {
    settingsPanel.classList.toggle("hidden");
});

// (기존) 설정 저장
saveSettingsButton.addEventListener("click", () => {
    try {
        localStorage.setItem("youtubeApiKey", apiKeyInput.value);
        localStorage.setItem("youtubeAvoidKeywords", avoidKeywordsInput.value);
        localStorage.setItem("youtubeAvoidChannels", avoidChannelsInput.value);
        alert("설정이 브라우저에 저장되었습니다.");
        settingsPanel.classList.add("hidden"); 
    } catch (e) {
        console.error("localStorage 저장 실패:", e);
        alert("설정을 저장하지 못했습니다.");
    }
});


// (기존) 날짜 필터
dateFilter.addEventListener("change", () => {
    if (dateFilter.value === "custom") {
        customDateInputs.classList.remove("hidden");
    } else {
        customDateInputs.classList.add("hidden");
    }
});

// (기존) 검색 버튼 이벤트
searchButton.addEventListener("click", () => performSearch());
searchTerm.addEventListener("keyup", (event) => {
    if (event.key === "Enter") performSearch();
});

// ⭐️ (수정) 연속 재생 버튼 (청크 로직 제거 -> 단일 탭으로)
playSelectedButton.addEventListener("click", () => {
    const checkedBoxes = document.querySelectorAll(".queue-checkbox:checked");
    if (checkedBoxes.length === 0) {
        alert("연속 재생할 영상을 1개 이상 선택하세요.");
        return;
    }
    const videoIds = Array.from(checkedBoxes).map(box => box.dataset.videoId);
    const videoIdString = videoIds.join(',');
    
    // 20개 이하로 검색되므로, URL 1개로만 호출 (기존 로직으로 복귀)
    const playlistUrl = `https://www.youtube.com/watch_videos?video_ids=${videoIdString}`;
    window.open(playlistUrl, '_blank');
});


// (기존) 선택 카운터 업데이트
function updateVideoCount() {
    const selectedCount = document.querySelectorAll(".queue-checkbox:checked").length;
    const totalCount = document.querySelectorAll(".queue-checkbox").length;
    videoCountSpan.textContent = (totalCount > 0) ? `${selectedCount} / ${totalCount}` : "";
}

// (기존) 전체 선택
selectAllCheckbox.addEventListener("change", () => {
    document.querySelectorAll(".queue-checkbox").forEach(box => {
        box.checked = selectAllCheckbox.checked;
    });
    updateVideoCount(); 
});

// (기존) 개별 체크박스
resultsDiv.addEventListener("change", (event) => {
    if (event.target.classList.contains("queue-checkbox")) {
        updateVideoCount();
    }
});

// (기존) ISO 8601 재생시간(PT4M13S)을 초로 변환하는 함수
function parseISO8601Duration(durationString) {
    if (!durationString) return 0;
    const regex = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/;
    const matches = durationString.match(regex);
    if (!matches) return 0;
    
    const hours = Number(matches[1] || 0);
    const minutes = Number(matches[2] || 0);
    const seconds = Number(matches[3] || 0);
    
    return (hours * 3600) + (minutes * 60) + seconds;
}


// (기존) YouTube API 검색 실행
async function performSearch() {
    const API_KEY = apiKeyInput.value; 
    let query = searchTerm.value;
    
    // (기존) 입력값 검증
    if (!query) { alert("검색어를 입력하세요."); return; }
    if (!API_KEY || API_KEY === "" || API_KEY.startsWith("AIzaSy...")) {
        alert("⚙️ 설정 패널에서 유효한 YouTube API 키를 입력하고 '설정 저장'을 눌러주세요.");
        settingsPanel.classList.remove("hidden"); 
        apiKeyInput.focus();
        return;
    }

    query = query.replace(/\s+or\s+/gi, " | ").replace(/\s+and\s+/gi, " ");

    // (기존) 로딩 UI
    resultsDiv.innerHTML = "";
    videoCountSpan.textContent = ""; 
    loadingDiv.classList.remove("hidden");
    playSelectedButton.classList.add("hidden"); 
    selectAllContainer.classList.add("hidden"); 

    const baseApiUrl = "https://www.googleapis.com/youtube/v3";

    try {
        // --- 1단계: 영상 검색 (Search: list) ---
        const searchParams = new URLSearchParams({
            part: "snippet",
            q: query, 
            type: "video",
            // ⭐️ (수정) 검색 결과 50개 -> 20개로 제한
            maxResults: 20, 
            key: API_KEY
        });
        
        // (기존) 날짜/길이 필터 적용
        const dateValue = dateFilter.value;
        if (dateValue === "custom") {
            if (startDate.value) searchParams.set("publishedAfter", new Date(startDate.value).toISOString());
            if (endDate.value) searchParams.set("publishedBefore", new Date(endDate.value).toISOString());
        } else if (dateValue !== "all") {
            const afterDate = new Date();
            // (수정된 코드) getDate()
            if (dateValue === "day") afterDate.setDate(afterDate.getDate() - 1); 
            if (dateValue === "week") afterDate.setDate(afterDate.getDate() - 7);
            if (dateValue === "month") afterDate.setMonth(afterDate.getMonth() - 1);
            if (dateValue === "year") afterDate.setFullYear(afterDate.getFullYear() - 1);
            searchParams.set("publishedAfter", afterDate.toISOString());
        }
        if (durationFilter.value !== "any") {
            searchParams.set("videoDuration", durationFilter.value);
        }

        const searchResponse = await fetch(`${baseApiUrl}/search?${searchParams.toString()}`);
        if (!searchResponse.ok) throw await createError(searchResponse, "1. 영상 검색");
        
        const searchData = await searchResponse.json();
        if (searchData.items.length === 0) {
            resultsDiv.innerHTML = "<p>검색 결과가 없습니다.</p>";
            return;
        }

        // --- 2단계: 영상 통계 (Videos: list - 조회수, 좋아요, ⭐️재생시간) ---
        const videoIds = searchData.items.map(item => item.id.videoId).join(',');
        const videoParams = new URLSearchParams({
            part: "statistics,contentDetails", 
            id: videoIds,
            key: API_KEY
        });
        const videoStatsResponse = await fetch(`${baseApiUrl}/videos?${videoParams.toString()}`);
        if (!videoStatsResponse.ok) throw await createError(videoStatsResponse, "2. 영상 통계");

        const videoStatsData = await videoStatsResponse.json();
        const videoDetailsMap = new Map(videoStatsData.items.map(item => [item.id, item]));

        // --- 3단계: 채널 통계 (Channels: list - 구독자) --- (기존과 동일)
        const channelIds = [...new Set(searchData.items.map(item => item.snippet.channelId))].join(',');
        const channelParams = new URLSearchParams({
            part: "statistics",
            id: channelIds,
            key: API_KEY
        });
        const channelStatsResponse = await fetch(`${baseApiUrl}/channels?${channelParams.toString()}`);
        if (!channelStatsResponse.ok) throw await createError(channelStatsResponse, "3. 채널 통계");

        const channelStatsData = await channelStatsResponse.json();
        const channelStatsMap = new Map(channelStatsData.items.map(item => [item.id, item.statistics]));

        // --- 4단계: 데이터 병합 --- (기존과 동일)
        const mergedItems = searchData.items.map(item => {
            const videoData = videoDetailsMap.get(item.id.videoId) || {};
            const videoStats = videoData.statistics || {};
            const videoContent = videoData.contentDetails || {};
            const channelStats = channelStatsMap.get(item.snippet.channelId) || {};
            
            return {
                ...item,
                statistics: {
                    viewCount: Number(videoStats.viewCount || 0),
                    likeCount: Number(videoStats.likeCount || 0),
                    subscriberCount: channelStats.hiddenSubscriberCount ? 0 : Number(channelStats.subscriberCount || 0)
                },
                contentDetails: {
                    duration: videoContent.duration || "PT0S" 
                }
            };
        });
        
        // --- 5단계: 클라이언트 측 필터링 (기존과 동일)
        const filteredResults = filterClientSide(mergedItems);

        // --- 6단계: 결과 표시 ---
        displayResults(filteredResults);

    } catch (error) {
        console.error(error);
        resultsDiv.innerHTML = `<p class="error">검색 중 오류가 발생했습니다: ${error.message}</p>`;
    } finally {
        loadingDiv.classList.add("hidden");
    }
}

// (기존) API 오류 헬퍼 함수
async function createError(response, step) {
    const errorData = await response.json();
    let message = `[${step} 오류] ${errorData.error.message}`;
    if (response.status === 403) {
        message = `[${step} 오류(403)] API 키 할당량이 초과되었거나 권한이 없습니다. '설정'을 확인하세요.`;
    } else if (response.status === 400 && errorData.error.errors[0].reason === "keyInvalid") {
        message = `[${step} 오류(400)] API 키가 유효하지 않습니다. '설정'에서 키를 다시 입력하세요.`;
    }
    return new Error(message);
}


// (기존) 기피/통계/비율 필터링 함수
function filterClientSide(items) {
    // (기존) 기피 필터
    const avoidKeywords = avoidKeywordsInput.value.split(",").map(k => k.trim().toLowerCase()).filter(k => k);
    const avoidChannels = avoidChannelsInput.value.split(",").map(c => c.trim().toLowerCase()).filter(c => c);

    // (기존) 통계 필터
    const minViews = Number(minViewsInput.value) || 0;
    const minLikes = Number(minLikesInput.value) || 0;
    const minSubscribers = Number(minSubscribersInput.value) || 0;

    // (기존) 비율(시간) 필터
    const aspectRatio = aspectRatioFilter.value; // 'any', 'wide', 'short'

    return items.filter(item => {
        // (기존) 기피 필터링
        const title = item.snippet.title.toLowerCase();
        const channel = item.snippet.channelTitle.toLowerCase();
        if (avoidKeywords.some(keyword => title.includes(keyword))) return false;
        if (avoidChannels.some(channelName => channel.includes(channelName))) return false;
        
        // (기존) 통계 필터링
        const stats = item.statistics;
        if (minViews > 0 && stats.viewCount < minViews) return false;
        if (minLikes > 0 && stats.likeCount < minLikes) return false;
        if (minSubscribers > 0 && stats.subscriberCount < minSubscribers) return false;

        // (기존) 비율(시간) 필터링
        if (aspectRatio !== 'any') {
            const durationInSeconds = parseISO8601Duration(item.contentDetails.duration);
            
            if (aspectRatio === 'short' && durationInSeconds > 61) return false;
            if (aspectRatio === 'wide' && durationInSeconds <= 61) return false;
        }

        return true;
    });
}

// (기존) 검색 결과 화면에 표시
function displayResults(items) {
    if (items.length === 0) {
        resultsDiv.innerHTML = "<p>검색 결과가 없습니다. (필터 조건 포함)</p>";
        playSelectedButton.classList.add("hidden");
        selectAllContainer.classList.add("hidden"); 
        updateVideoCount(); 
        return;
    }

    playSelectedButton.classList.remove("hidden");
    selectAllContainer.classList.remove("hidden"); 
    selectAllCheckbox.checked = false; 

    // (기존) 숫자 포맷 헬퍼 함수
    const formatStat = (num) => {
        if (num < 1000) return num.toLocaleString("ko-KR");
        if (num < 10000) return (num / 1000).toFixed(1) + "천";
        if (num < 100000000) return (num / 10000).toFixed(1) + "만";
        return (num / 100000000).toFixed(1) + "억";
    };

    items.forEach(item => {
        const videoId = item.id.videoId;
        const title = item.snippet.title;
        const channel = item.snippet.channelTitle;
        const publishedAt = new Date(item.snippet.publishedAt).toLocaleDateString("ko-KR");
        const thumbnail = item.snippet.thumbnails.medium.url;

        // (기존) 통계 정보
        const stats = item.statistics;
        const viewCount = formatStat(stats.viewCount);
        const likeCount = stats.likeCount > 0 ? formatStat(stats.likeCount) : "---";
        const subscriberCount = stats.subscriberCount > 0 ? formatStat(stats.subscriberCount) : "비공개";

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
                    <p class="video-stats">
                        <span>📈 ${viewCount}회</span> | <span>👍 ${likeCount}</span> | <span>👥 ${subscriberCount}명</span>
                    </p>
                </div>
            </div>
        `;
        resultsDiv.innerHTML += videoElement;
    });

    updateVideoCount();
}
