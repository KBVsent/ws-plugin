import { makeSendMsg, makeForwardMsg } from './makeMsg.js'
import { getMsgMap, setMsgMap } from './msgMap.js'

async function getApiData(api, params = {}) {
    let sendRet = null
    let ResponseData = null
    let publicApi = {
        'send_msg': async (params) => {
            let sendMsg = await makeSendMsg(params)
            if (sendMsg[0].length > 0) {
                if (params.message_type == 'group' || params.group_id) {
                    sendRet = await Bot.pickGroup(params.group_id).sendMsg(...sendMsg)
                } else if (params.message_type == 'private' || params.user_id) {
                    sendRet = await Bot.pickFriend(params.user_id).sendMsg(...sendMsg)
                }
            }
        },
        'send_private_msg': async (params) => {
            let sendMsg = await makeSendMsg(params)
            if (sendMsg[0].length > 0) {
                sendRet = await Bot.pickFriend(params.user_id).sendMsg(...sendMsg)
            }
        },
        'send_group_msg': async (params) => {
            let sendMsg = await makeSendMsg(params)
            if (sendMsg[0].length > 0) {
                sendRet = await Bot.pickGroup(params.group_id).sendMsg(...sendMsg)
            }
        },
        'send_group_forward_msg': async (params) => {
            let sendMsg = await makeForwardMsg(params)
            sendRet = await Bot.pickGroup(params.group_id).sendMsg(sendMsg)
        },
        'send_private_forward_msg': async (params) => {
            let sendMsg = await makeForwardMsg(params)
            sendRet = await Bot.pickFriend(params.user_id).sendMsg(sendMsg)
        },
        'set_group_ban': async (params) => {
            ResponseData = await Bot.setGroupBan(params.group_id, params.user_id, params.duration)
        },
        'get_group_member_list': async (params) => {
            let list = await Bot.getGroupMemberList(params.group_id)
            ResponseData = Array.from(list.values())
        },
        'get_group_member_info': async (params) => {
            try {
                ResponseData = await Bot.getGroupMemberInfo(params.group_id, params.user_id);
            } catch (error) {
                console.log(error);
            }
        },
        'get_stranger_info': async (params) => {
            ResponseData = await Bot.getStrangerInfo(params.user_id)
        },
        'delete_msg': async (params) => {
            let msg = getMsgMap(params.message_id)
            await Bot.deleteMsg(msg.message_id)
        },
        'get_msg': async (params) => {
            ResponseData = getMsgMap(params.message_id)
        },
        'get_login_info': async params => {
            ResponseData = {
                user_id: Bot.uin,
                nickname: Bot.nickname
            }
        },
        'get_guild_service_profile': async params => {
            ResponseData = {
                avatar_url: Bot.pickFriend(Bot.uin).getAvatarUrl(),
                nickname: Bot.nickname,
                tiny_id: Bot.tiny_id
            }
        },
        '_set_model_show': async params => {
            //暂时不知道这个方法是干嘛的
        },
        'get_online_clients': async params => {
            //这个也不知道
            ResponseData = {
                clients: []
            }
        },
        'get_version_info': async params => {
            //不知道怎么获取
            ResponseData = {
                app_full_name: 'icqq',
                app_name: 'icqq',
                app_version: 'v0.3.10',
                coolq_directory: process.cwd(),
                coolq_edition: 'pro',
                'go-cqhttp': true,
                plugin_build_configuration: 'release',
                plugin_build_number: 99,
                plugin_version: '4.15.0',
                protocol_name: 6,
                protocol_version: 'v11',
                runtime_os: 'windows',
                runtime_version: 'go1.20.3',
                version: 'v1.0.1'
            }
        },
        'get_friend_list': async params => {
            let list = await Bot.getFriendList()
            ResponseData = Array.from(list.values())
        },
        'get_group_list': async params => {
            let list = await Bot.getGroupList()
            ResponseData = Array.from(list.values())
        },
        'get_guild_list': async params => {
            //获取频道列表?
            ResponseData = []
        },
        'get_group_info': async params => {
            ResponseData = await Bot.getGroupInfo(params.group_id)
        }
    }
    if (typeof publicApi[api] === 'function') {
        await publicApi[api](params)
        if (sendRet) {
            ResponseData = {
                message_id: sendRet.rand,
                time: sendRet.time
            }
            setMsgMap(sendRet.rand, { ...sendRet })
        }
        return ResponseData
    } else {
        logger.warn(`未适配的api: ${api}`);
    }
}

export {
    getApiData
}