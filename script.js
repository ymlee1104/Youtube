document.addEventListener("DOMContentLoaded", () => {
    // --- 1. DOM 요소 선택 ---
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
    const aspectRatioFilter = document.getElementById("aspectRatioFilter");

    // 통계 필터 요소
    const minViewsInput = document.getElementById("minViews");
    const minLikesInput = document.getElementById("minLikes");
    const minSubscribersInput = document.getElementById("minSubscribers");

    // 설정 패널 요소
    const toggleSettingsButton = document.getElementById("toggleSettingsButton");
    const settingsPanel = document.getElementById("settingsPanel");
    const saveSettingsButton = document.getElementById("saveSettingsButton");
    const apiKeyInput = document.getElementById("apiKey");
    const avoidKeywordsInput = document.getElementById("avoidKeywords");
    const avoidChannelsInput = document.getElementById("avoidChannels");

    // --- 2. 설정 로드 (페이지 로드 시) ---
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

    // --- 3. 이벤트 리스너 ---

    // 설정 패널 토글
    toggleSettingsButton.addEventListener("click", () => {
        settingsPanel.classList.toggle("hidden");
    });

    // 설정 저장 (로컬 스토리지)
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

    // 날짜 필터 '사용자 지정' UI 토글
    dateFilter.addEventListener("change", () => {
        if (dateFilter.value === "custom") {
            customDateInputs.classList.remove("hidden");
        } else {
            customDateInputs.classList.add("hidden");
        }
    });

    // 검색 실행 (클릭 또는 Enter)
    searchButton.addEventListener("click", performSearch);
    searchTerm.addEventListener("keyup", (event) => {
        if (event.key === "Enter") performSearch();
    });

    // 연속 재생 버튼 (단일 탭, 'Untitled List' 방식)
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

    // '전체 선택' 체크박스
    selectAllCheckbox.addEventListener("change", () => {
        document.querySelectorAll(".queue-checkbox").forEach(box => {
            box.checked = selectAllCheckbox.checked;
        });
        updateVideoCount();
    });

    // 개별 체크박스 선택 시 카운트 업데이트
    resultsDiv.addEventListener("change", (event) => {
        if (event.target.classList.contains("queue-checkbox")) {
            updateVideoCount();
        }
    });

    // --- 4. 핵심 검색 로직 ---

    /** YouTube API 검색 실행 */
    async function performSearch() {
        const API_KEY = apiKeyInput.value;
        let query = searchTerm.value;

        // API 키 및 검색어 유효성 검사
        if (!query) {
            alert("검색어를 입력하세요.");
            return;
        }
        if (!API_KEY || API_KEY === "" || API_KEY.startsWith("AIzaSy...")) {
            alert("⚙️ 설정 패널에서 유효한 YouTube API 키를 입력하고 '설정 저장'을 눌러주세요.");
            settingsPanel.classList.remove("hidden");
            apiKeyInput.focus();
            return;
        }

        // 'OR' 기호 처리
        query = query.replace(/\s+or\s+/gi, " | ").replace(/\s+and\s+/gi, " ");

        // UI 초기화
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
                maxResults: 20, // 20개로 제한 (안정적인 'Untitled List' 생성을 위해)
                key: API_KEY
            });

            // 날짜/길이 API 파라미터 적용
            const dateValue = dateFilter.value;
            if (dateValue === "custom") {
                if (startDate.value) searchParams.set("publishedAfter", new Date(startDate.value).toISOString());
                if (endDate.value) searchParams.set("publishedBefore", new Date(endDate.value).toISOString());
            } else if (dateValue !== "all") {
                const afterDate = new Date();
                if (dateValue === "day") afterDate.setDate(afterDate.getDate() - 1); // getDate() 수정본
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

            // --- 2단계: 영상 통계 (Videos: list - 조회수, 좋아요, 재생시간) ---
            const videoIds = searchData.items.map(item => item.id.videoId).join(',');
            const videoParams = new URLSearchParams({
                part: "statistics,contentDetails", // 재생 시간(contentDetails) 포함
                id: videoIds,
                key: API_KEY
            });
            const videoStatsResponse = await fetch(`${baseApiUrl}/videos?${videoParams.toString()}`);
            if (!videoStatsResponse.ok) throw await createError(videoStatsResponse, "2. 영상 통계");

            const videoStatsData = await videoStatsResponse.json();
            const videoDetailsMap = new Map(videoStatsData.items.map(item => [item.id, item]));

            // --- 3단계: 채널 통계 (Channels: list - 구독자) ---
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

            // --- 4단계: 데이터 병합 ---
            const mergedItems = searchData.items.map(item => {
                const videoData = videoDetailsMap.get(item.id.videoId) || {};
                const videoStats = videoData.statistics || {};
                const videoContent = videoData.contentDetails || {}; // 재생 시간 정보
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

            // --- 5단계: 클라이언트 측 필터링 (기피, 통계, 숏폼) ---
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

    // --- 5. 헬퍼(Helper) 함수 ---

    /** 클라이언트 측 필터링: 기피, 통계, 숏폼(시간) */
    function filterClientSide(items) {
        // 설정값 가져오기
        const avoidKeywords = avoidKeywordsInput.value.split(",").map(k => k.trim().toLowerCase()).filter(k => k);
        const avoidChannels = avoidChannelsInput.value.split(",").map(c => c.trim().toLowerCase()).filter(c => c);
        const minViews = Number(minViewsInput.value) || 0;
        const minLikes = Number(minLikesInput.value) || 0;
        const minSubscribers = Number(minSubscribersInput.value) || 0;
        const aspectRatio = aspectRatioFilter.value;

        return items.filter(item => {
            // 1. 기피 필터링
            const title = item.snippet.title.toLowerCase();
            const channel = item.snippet.channelTitle.toLowerCase();
            if (avoidKeywords.some(keyword => title.includes(keyword))) return false;
            if (avoidChannels.some(channelName => channel.includes(channelName))) return false;

            // 2. 통계 필터링
            const stats = item.statistics;
            if (minViews > 0 && stats.viewCount < minViews) return false;
            if (minLikes > 0 && stats.likeCount < minLikes) return false;
            if (minSubscribers > 0 && stats.subscriberCount < minSubscribers) return false;

            // 3. 숏폼(시간) 필터링
            if (aspectRatio !== 'any') {
                const durationInSeconds = parseISO8601Duration(item.contentDetails.duration);
                // '숏 영상' 선택 시 61초 초과면 탈락
                if (aspectRatio === 'short' && durationInSeconds > 61) return false;
                // '일반 영상' 선택 시 61초 이하면 탈락
                if (aspectRatio === 'wide' && durationInSeconds <= 61) return false;
            }

            return true;
        });
    }

    /** 검색 결과 HTML로 표시 */
    function displayResults(items) {
        // 결과 없음 UI
        if (items.length === 0) {
            resultsDiv.innerHTML = "<p>검색 결과가 없습니다. (필터 조건 포함)</p>";
            playSelectedButton.classList.add("hidden");
            selectAllContainer.classList.add("hidden");
            updateVideoCount();
            return;
        }

        // 결과 있음 UI
        playSelectedButton.classList.remove("hidden");
        selectAllContainer.classList.remove("hidden");
        selectAllCheckbox.checked = false;

        // 숫자 포맷 헬퍼 함수
        const formatStat = (num) => {
            if (num < 1000) return num.toLocaleString("ko-KR");
            if (num < 10000) return (num / 1000).toFixed(1) + "천";
            if (num < 100000000) return (num / 10000).toFixed(1) + "만";
            return (num / 100000000).toFixed(1) + "억";
        };

        let htmlContent = "";
        items.forEach(item => {
            const videoId = item.id.videoId;
            const title = item.snippet.title;
            const channel = item.snippet.channelTitle;
            const publishedAt = new Date(item.snippet.publishedAt).toLocaleDateString("ko-KR");
            const thumbnail = item.snippet.thumbnails.medium.url;

            const stats = item.statistics;
            const viewCount = formatStat(stats.viewCount);
            const likeCount = stats.likeCount > 0 ? formatStat(stats.likeCount) : "---";
            const subscriberCount = stats.subscriberCount > 0 ? formatStat(stats.subscriberCount) : "비공개";

            htmlContent += `
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
        });
        
        resultsDiv.innerHTML = htmlContent;
        updateVideoCount();
    }

    /** ISO 8601 형식의 재생시간(예: "PT4M13S")을 초(seconds)로 변환 */
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

    /** 선택된 비디오 카운트 업데이트 */
    function updateVideoCount() {
        const selectedCount = document.querySelectorAll(".queue-checkbox:checked").length;
        const totalCount = document.querySelectorAll(".queue-checkbox").length;
        videoCountSpan.textContent = (totalCount > 0) ? `${selectedCount} / ${totalCount}` : "";
    }

    /** API 오류 메시지 생성 헬퍼 */
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
});