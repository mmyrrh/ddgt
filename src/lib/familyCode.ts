const CHOSEONG_KEYS = [
  "r",
  "R",
  "s",
  "e",
  "E",
  "f",
  "a",
  "q",
  "Q",
  "t",
  "T",
  "d",
  "w",
  "W",
  "c",
  "z",
  "x",
  "v",
  "g",
];

const JUNGSEONG_KEYS = [
  "k",
  "o",
  "i",
  "O",
  "j",
  "p",
  "u",
  "P",
  "h",
  "hk",
  "ho",
  "hl",
  "y",
  "n",
  "nj",
  "np",
  "nl",
  "b",
  "m",
  "ml",
  "l",
];

const JONGSEONG_KEYS = [
  "",
  "r",
  "R",
  "rt",
  "s",
  "sw",
  "sg",
  "e",
  "f",
  "fr",
  "fa",
  "fq",
  "ft",
  "fx",
  "fv",
  "fg",
  "a",
  "q",
  "qt",
  "t",
  "T",
  "d",
  "w",
  "c",
  "z",
  "x",
  "v",
  "g",
];

const JAMO_KEYS: Record<string, string> = {
  ㄱ: "r",
  ㄲ: "R",
  ㄳ: "rt",
  ㄴ: "s",
  ㄵ: "sw",
  ㄶ: "sg",
  ㄷ: "e",
  ㄸ: "E",
  ㄹ: "f",
  ㄺ: "fr",
  ㄻ: "fa",
  ㄼ: "fq",
  ㄽ: "ft",
  ㄾ: "fx",
  ㄿ: "fv",
  ㅀ: "fg",
  ㅁ: "a",
  ㅂ: "q",
  ㅃ: "Q",
  ㅄ: "qt",
  ㅅ: "t",
  ㅆ: "T",
  ㅇ: "d",
  ㅈ: "w",
  ㅉ: "W",
  ㅊ: "c",
  ㅋ: "z",
  ㅌ: "x",
  ㅍ: "v",
  ㅎ: "g",

  ㅏ: "k",
  ㅐ: "o",
  ㅑ: "i",
  ㅒ: "O",
  ㅓ: "j",
  ㅔ: "p",
  ㅕ: "u",
  ㅖ: "P",
  ㅗ: "h",
  ㅘ: "hk",
  ㅙ: "ho",
  ㅚ: "hl",
  ㅛ: "y",
  ㅜ: "n",
  ㅝ: "nj",
  ㅞ: "np",
  ㅟ: "nl",
  ㅠ: "b",
  ㅡ: "m",
  ㅢ: "ml",
  ㅣ: "l",
};

function convertHangulCharacter(character: string) {
  const code = character.charCodeAt(0);

  // 완성형 한글: 가 ~ 힣
  if (code >= 0xac00 && code <= 0xd7a3) {
    const syllableIndex = code - 0xac00;

    const choseongIndex = Math.floor(
      syllableIndex / 588
    );

    const jungseongIndex = Math.floor(
      (syllableIndex % 588) / 28
    );

    const jongseongIndex =
      syllableIndex % 28;

    return (
      CHOSEONG_KEYS[choseongIndex] +
      JUNGSEONG_KEYS[jungseongIndex] +
      JONGSEONG_KEYS[jongseongIndex]
    );
  }

  // ㄱ, ㅏ 같은 한글 자모
  if (JAMO_KEYS[character]) {
    return JAMO_KEYS[character];
  }

  return character;
}

/**
 * 가족코드 정규화
 *
 * - 한글 키 입력 -> 같은 물리 영문키로 변환
 * - 영문 소문자 -> 대문자
 * - 숫자 허용
 * - 특수문자/공백 제거
 * - 최대 12자리
 */
export function normalizeFamilyCodeInput(
  value: string
) {
  const converted = Array.from(value)
    .map(convertHangulCharacter)
    .join("");

  return converted
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase()
    .slice(0, 12);
}

/**
 * 키보드가 한글 모드여도
 * 물리 키 위치를 영문으로 판단
 *
 * KeyA -> A
 * KeyM -> M
 * Digit1 -> 1
 */
export function getEnglishKeyFromCode(
  code: string
) {
  if (/^Key[A-Z]$/.test(code)) {
    return code.slice(3);
  }

  if (/^Digit[0-9]$/.test(code)) {
    return code.slice(5);
  }

  if (/^Numpad[0-9]$/.test(code)) {
    return code.slice(6);
  }

  return null;
}