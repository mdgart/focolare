/**
 * The buttons a cook timer carries, named in one place.
 *
 * Both platforms match a notification to its buttons by an id agreed in
 * advance: registered once at startup, referenced at schedule time. Get the two
 * out of step and the notification simply arrives with no buttons — no error,
 * nothing in a log, just a plain alert where an actionable one was intended.
 * Sharing the constant is what keeps that from happening quietly.
 */
export const COOK_TIMER_ACTION_TYPE = "focolare-cook-timer";

/**
 * Five minutes: long enough to matter for something that needs a bit longer,
 * short enough that pressing it twice is reasonable rather than a sign the
 * button is the wrong size.
 */
export const EXTEND_SECONDS = 5 * 60;
